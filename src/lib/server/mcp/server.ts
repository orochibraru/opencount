import {
	type AuthInfo,
	bearerAuthChallengeResponse,
	createMcpHandler,
	getOAuthProtectedResourceMetadataUrl,
	McpServer,
	OAuthError,
	OAuthErrorCode,
	verifyBearerToken,
} from "@modelcontextprotocol/server";
import { verifyJwsAccessToken } from "better-auth/oauth2";
import { z } from "zod";

import { customCategoryIcons } from "#lib/categories.js";
import { categoryLabels } from "#lib/category-labels.js";
import { AiAppDTO } from "#lib/dto/ai-app.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { GroupDTO } from "#lib/dto/group.js";
import { MerchantDTO } from "#lib/dto/merchant.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { minorToDecimal } from "#lib/money.js";
import { authService } from "#lib/server/auth/auth.js";
import { configuration } from "#lib/server/core/config.js";

const jwksCacheKey = {};

interface LedgerEntry {
	id: string;
	description: string;
	amount: string;
	currency: string;
	date: string;
	kind?: string;
	category: string;
	merchant?: string | null;
}

interface Ledger {
	categories: { id: string; name: string }[];
	page(
		limit: number,
		offset: number,
		uncategorizedOnly: boolean,
	): { total: number; expenses: LedgerEntry[] };
	recategorize(ids: string[], category: string): number;
	addCategory(name: string, icon: string): { id: string; name: string };
}

const categoryIconNames = Object.keys(customCategoryIcons) as [
	string,
	...string[],
];

const builtInCategories = Object.entries(categoryLabels).map(([id, name]) => ({
	id,
	name,
}));

const merchantGroupField = z
	.string()
	.min(1)
	.describe(
		"A group id from list_groups: merchants belong to a shared group, personal expenses have none.",
	);

const groupIdField = z
	.string()
	.min(1)
	.optional()
	.describe(
		"A group id from list_groups to work on that shared group; leave it out for the person's own expenses.",
	);

/** The MCP server AI apps reach at `/mcp`, acting on the expenses of whoever signed them in. */
class McpEndpoint {
	/**
	 * Answers one MCP request reaching `url` for the person whose access token it carries, or the challenge that sends an
	 * AI app through sign-in and consent when the token is missing, expired or revoked; a 404 off HTTPS.
	 */
	async handle(request: Request, url: URL): Promise<Response> {
		const resource = authService.mcpResource(
			authService.publicOrigin() ?? url.origin,
		);
		if (!resource) {
			return Response.json(
				{ message: "AI apps need this server on HTTPS." },
				{ status: 404 },
			);
		}
		const resourceUrl = new URL(resource);
		const challenge = {
			resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
		};
		let userId: string;
		try {
			const info = await verifyBearerToken(
				request.headers.get("authorization"),
				{
					...challenge,
					expectedResource: resourceUrl,
					verifier: {
						verifyAccessToken: (token) => this.#verify(token, resourceUrl),
					},
				},
			);
			userId = String(info.extra?.userId);
		} catch (error) {
			return bearerAuthChallengeResponse(error, challenge);
		}
		return createMcpHandler(() => this.#serverFor(userId)).fetch(request);
	}

	/** An MCP server whose tools act as `userId`. */
	#serverFor(userId: string): McpServer {
		const server = new McpServer({
			name: "OpenCount",
			version: configuration.get().appVersion,
		});
		server.registerTool(
			"list_groups",
			{
				title: "List groups",
				description:
					"The shared groups the person belongs to, each with its id, name and currency. Members and balances stay out.",
				annotations: { readOnlyHint: true },
			},
			() =>
				this.#reply({
					groups: GroupDTO.forMember(userId).map((entry) => {
						const { id, name, currency } = entry.toJSON();
						return { id, name, currency };
					}),
				}),
		);
		server.registerTool(
			"list_categories",
			{
				title: "List categories",
				description:
					"The categories an expense can be filed under, each with the id set_categories expects: the built-in ones plus the person's own, or the group's own with groupId.",
				inputSchema: z.object({ groupId: groupIdField }),
				annotations: { readOnlyHint: true },
			},
			({ groupId }) =>
				this.#withLedger(userId, groupId, (ledger) => ({
					categories: ledger.categories,
				})),
		);
		server.registerTool(
			"list_expenses",
			{
				title: "List expenses",
				description:
					"Expenses latest first, the person's own or a group's with groupId: id, description, amount, currency, date and category (and expense or income for personal ones). Uncategorized ones (category other) only, unless uncategorizedOnly is false. Who paid and how it was split never show.",
				inputSchema: z.object({
					groupId: groupIdField,
					uncategorizedOnly: z.boolean().default(true),
					limit: z.number().int().min(1).max(200).default(100),
					offset: z.number().int().min(0).default(0),
				}),
				annotations: { readOnlyHint: true },
			},
			({ groupId, uncategorizedOnly, limit, offset }) =>
				this.#withLedger(userId, groupId, (ledger) =>
					ledger.page(limit, offset, uncategorizedOnly),
				),
		);
		server.registerTool(
			"set_categories",
			{
				title: "Categorize expenses",
				description:
					"Files expenses under categories, up to 200 at once, the person's own or a group's with groupId. Each category is an id from list_categories for the same groupId; an unknown one is skipped and named back.",
				inputSchema: z.object({
					groupId: groupIdField,
					changes: z
						.array(
							z.object({ id: z.string().min(1), category: z.string().min(1) }),
						)
						.min(1)
						.max(200),
				}),
				annotations: {
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: true,
				},
			},
			({ groupId, changes }) =>
				this.#withLedger(userId, groupId, (ledger) => {
					const known = new Set(ledger.categories.map((entry) => entry.id));
					const byCategory = Map.groupBy(changes, (change) => change.category);
					let updated = 0;
					for (const [category, entries] of byCategory) {
						if (known.has(category)) {
							updated += ledger.recategorize(
								entries.map((entry) => entry.id),
								category,
							);
						}
					}
					return {
						updated,
						unknownCategories: [...byCategory.keys()].filter(
							(category) => !known.has(category),
						),
					};
				}),
		);
		this.#registerCreateCategory(server, userId);
		this.#registerMerchantTools(server, userId);
		return server;
	}

	/** Adds the tool that creates a category. */
	#registerCreateCategory(server: McpServer, userId: string): void {
		server.registerTool(
			"create_category",
			{
				title: "Create a category",
				description:
					"Adds a category to the person's own expenses, or to a group's with groupId, with an icon from the listed names. A category already named that way, whatever its case, built-in or not, is returned instead of doubled. Use its id with set_categories.",
				inputSchema: z.object({
					groupId: groupIdField,
					name: z.string().trim().min(1).max(40),
					icon: z.enum(categoryIconNames),
				}),
				annotations: {
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: true,
				},
			},
			({ groupId, name, icon }) =>
				this.#withLedger(userId, groupId, (ledger) => {
					const existing = ledger.categories.find(
						(entry) =>
							entry.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
					);
					return existing
						? { category: existing, existed: true }
						: { category: ledger.addCategory(name, icon), existed: false };
				}),
		);
	}

	/** Adds the tools that list, create and assign a group's merchants. */
	#registerMerchantTools(server: McpServer, userId: string): void {
		server.registerTool(
			"list_merchants",
			{
				title: "List merchants",
				description:
					"The merchants a group has paid, most used first, each with its id and the category it was last filed under.",
				inputSchema: z.object({ groupId: merchantGroupField }),
				annotations: { readOnlyHint: true },
			},
			({ groupId }) =>
				this.#withLedger(userId, groupId, () => ({
					merchants: MerchantDTO.forGroup(groupId).map((entry) =>
						this.#merchantJson(entry),
					),
				})),
		);
		server.registerTool(
			"create_merchant",
			{
				title: "Create a merchant",
				description:
					"Adds a merchant to a group, filed under a category id from list_categories for that group. A merchant already saved under that name, whatever its case, is returned as it is instead of doubled. Returns its id for set_merchants.",
				inputSchema: z.object({
					groupId: merchantGroupField,
					name: z.string().trim().min(1).max(80),
					category: z.string().min(1),
				}),
				annotations: {
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: true,
				},
			},
			({ groupId, name, category }) =>
				this.#withLedger(userId, groupId, (ledger) => {
					if (!ledger.categories.some((entry) => entry.id === category)) {
						return {
							error: `Unknown category ${category}. Call list_categories.`,
						};
					}
					const existing = MerchantDTO.findByName(groupId, name);
					if (existing) {
						return { merchant: this.#merchantJson(existing), existed: true };
					}
					const id = MerchantDTO.remember(groupId, name, category);
					return { merchant: { id, name, category }, existed: false };
				}),
		);
		server.registerTool(
			"set_merchants",
			{
				title: "Assign merchants",
				description:
					"Puts a merchant on a group's expenses, up to 200 at once: each change names an expense id from list_expenses and a merchant id from list_merchants or create_merchant, or null to clear it. Transfers are left alone; an unknown merchant is skipped and named back.",
				inputSchema: z.object({
					groupId: merchantGroupField,
					changes: z
						.array(
							z.object({
								id: z.string().min(1),
								merchantId: z.string().min(1).nullable(),
							}),
						)
						.min(1)
						.max(200),
				}),
				annotations: {
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: true,
				},
			},
			({ groupId, changes }) =>
				this.#withLedger(userId, groupId, () => {
					const byMerchant = Map.groupBy(
						changes,
						(change) => change.merchantId,
					);
					const unknownMerchants: string[] = [];
					let updated = 0;
					for (const [merchantId, entries] of byMerchant) {
						if (merchantId && !MerchantDTO.findInGroup(groupId, merchantId)) {
							unknownMerchants.push(merchantId);
							continue;
						}
						updated += ExpenseDTO.assignMerchant(
							groupId,
							entries.map((entry) => entry.id),
							merchantId,
						);
					}
					return { updated, unknownMerchants };
				}),
		);
	}

	/** Checks an access token was issued here for `resource` to an AI app `userId` still allows. */
	async #verify(token: string, resource: URL): Promise<AuthInfo> {
		const claims = await verifyJwsAccessToken(token, {
			jwksFetch: () => authService.get().api.getJwks(),
			jwksCacheKey,
			verifyOptions: {
				issuer: `${resource.origin}/api/auth`,
				audience: resource.href,
			},
		}).catch(() => {
			throw new OAuthError(OAuthErrorCode.InvalidToken, "Sign in again.");
		});
		const userId = claims.sub;
		const clientId = typeof claims.azp === "string" ? claims.azp : undefined;
		if (!userId || !clientId || !AiAppDTO.allowed(userId, clientId)) {
			throw new OAuthError(OAuthErrorCode.InvalidToken, "Sign in again.");
		}
		return {
			token,
			clientId,
			scopes: typeof claims.scope === "string" ? claims.scope.split(" ") : [],
			expiresAt: claims.exp,
			resource,
			extra: { userId },
		};
	}

	/** Runs `use` on the personal or group ledger and replies with what it returns, an error when the group is unknown. */
	#withLedger(
		userId: string,
		groupId: string | undefined,
		use: (ledger: Ledger) => unknown,
	) {
		const ledger = groupId
			? this.#groupLedger(userId, groupId)
			: this.#personalLedger(userId);
		if (!ledger) {
			return {
				...this.#reply({
					error: "No such group. Call list_groups for the ids.",
				}),
				isError: true,
			};
		}
		const value = use(ledger);
		return {
			...this.#reply(value),
			isError: typeof value === "object" && value !== null && "error" in value,
		};
	}

	/** `userId`'s own expenses, as a ledger the tools work on. */
	#personalLedger(userId: string): Ledger {
		return {
			categories: [
				...builtInCategories,
				...PersonalCategoryDTO.forUser(userId).map((entry) =>
					this.#idAndName(entry),
				),
			],
			page: (limit, offset, uncategorizedOnly) => {
				const page = PersonalExpenseDTO.page(userId, {
					limit,
					offset,
					category: uncategorizedOnly ? "other" : undefined,
				});
				return {
					total: page.total,
					expenses: page.entries.map((entry) => {
						const row = entry.toJSON();
						return {
							id: row.id,
							description: row.description,
							amount: minorToDecimal(row.amountMinor, row.currency),
							currency: row.currency,
							date: row.spentOn,
							kind: row.kind,
							category: row.category,
						};
					}),
				};
			},
			recategorize: (ids, category) =>
				PersonalExpenseDTO.recategorize(userId, ids, category),
			addCategory: (name, icon) =>
				this.#idAndName(PersonalCategoryDTO.create(userId, name, icon)),
		};
	}

	/** Group `groupId`'s expenses as a ledger, or `undefined` when `userId` isn't a member. */
	#groupLedger(userId: string, groupId: string): Ledger | undefined {
		const group = GroupDTO.findForMember(groupId, userId);
		if (!group) {
			return undefined;
		}
		const { currency } = group.toJSON();
		return {
			categories: [
				...builtInCategories,
				...GroupCategoryDTO.forGroup(groupId).map((entry) =>
					this.#idAndName(entry),
				),
			],
			page: (limit, offset, uncategorizedOnly) => {
				const page = ExpenseDTO.page(groupId, {
					limit,
					offset,
					kind: "expense",
					category: uncategorizedOnly ? "other" : undefined,
				});
				const merchantName = (merchantId: string | null) =>
					merchantId
						? (MerchantDTO.findInGroup(groupId, merchantId)?.toJSON().name ??
							null)
						: null;
				return {
					total: page.total,
					expenses: page.entries.map((entry) => {
						const row = entry.toJSON();
						return {
							id: row.id,
							description: row.description,
							amount: minorToDecimal(row.amountMinor, currency),
							currency,
							date: row.spentOn,
							category: row.category,
							merchant: merchantName(row.merchantId),
						};
					}),
				};
			},
			recategorize: (ids, category) =>
				ExpenseDTO.recategorize(groupId, ids, category),
			addCategory: (name, icon) =>
				this.#idAndName(GroupCategoryDTO.create(groupId, name, icon)),
		};
	}

	/** A tool result carrying `value` as JSON text. */
	#reply(value: unknown) {
		return {
			content: [{ type: "text" as const, text: JSON.stringify(value) }],
		};
	}

	/** The id and name of a category row. */
	#idAndName(entry: { toJSON(): { id: string; name: string } }) {
		const { id, name } = entry.toJSON();
		return { id, name };
	}

	/** The fields of a merchant the tools show. */
	#merchantJson(entry: MerchantDTO) {
		const { id, name, category } = entry.toJSON();
		return { id, name, category };
	}
}

export const mcpEndpoint = new McpEndpoint();
