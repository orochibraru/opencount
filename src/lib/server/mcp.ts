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

import { categoryLabels } from "#lib/category-labels.js";
import { AiAppDTO } from "#lib/dto/ai-app.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { GroupDTO } from "#lib/dto/group.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { minorToDecimal } from "#lib/money.js";
import { getAuth, mcpResource, publicOrigin } from "#lib/server/auth.js";
import { getConfig } from "#lib/server/config.js";

const jwksCacheKey = {};

interface LedgerEntry {
	id: string;
	description: string;
	amount: string;
	currency: string;
	date: string;
	kind?: string;
	category: string;
}

interface Ledger {
	categories: { id: string; name: string }[];
	page(
		limit: number,
		offset: number,
		uncategorizedOnly: boolean,
	): { total: number; expenses: LedgerEntry[] };
	recategorize(ids: string[], category: string): number;
}

const builtInCategories = Object.entries(categoryLabels).map(([id, name]) => ({
	id,
	name,
}));

function named(entries: { toJSON(): { id: string; name: string } }[]) {
	return entries.map((entry) => {
		const { id, name } = entry.toJSON();
		return { id, name };
	});
}

function personalLedger(userId: string): Ledger {
	return {
		categories: [
			...builtInCategories,
			...named(PersonalCategoryDTO.forUser(userId)),
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
	};
}

function groupLedger(userId: string, groupId: string): Ledger | undefined {
	const group = GroupDTO.findForMember(groupId, userId);
	if (!group) {
		return undefined;
	}
	const { currency } = group.toJSON();
	return {
		categories: [
			...builtInCategories,
			...named(GroupCategoryDTO.forGroup(groupId)),
		],
		page: (limit, offset, uncategorizedOnly) => {
			const page = ExpenseDTO.page(groupId, {
				limit,
				offset,
				kind: "expense",
				category: uncategorizedOnly ? "other" : undefined,
			});
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
					};
				}),
			};
		},
		recategorize: (ids, category) =>
			ExpenseDTO.recategorize(groupId, ids, category),
	};
}

function reply(value: unknown) {
	return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function withLedger(
	userId: string,
	groupId: string | undefined,
	use: (ledger: Ledger) => unknown,
) {
	const ledger = groupId
		? groupLedger(userId, groupId)
		: personalLedger(userId);
	if (!ledger) {
		return {
			...reply({ error: "No such group. Call list_groups for the ids." }),
			isError: true,
		};
	}
	return reply(use(ledger));
}

const groupIdField = z
	.string()
	.min(1)
	.optional()
	.describe(
		"A group id from list_groups to work on that shared group; leave it out for the person's own expenses.",
	);

function serverFor(userId: string): McpServer {
	const server = new McpServer({
		name: "OpenCount",
		version: getConfig().appVersion,
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
			reply({
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
			withLedger(userId, groupId, (ledger) => ({
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
			withLedger(userId, groupId, (ledger) =>
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
			withLedger(userId, groupId, (ledger) => {
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
	return server;
}

async function verify(token: string, resource: URL): Promise<AuthInfo> {
	const claims = await verifyJwsAccessToken(token, {
		jwksFetch: () => getAuth().api.getJwks(),
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

/**
 * Answers one MCP request reaching `url` for the person whose access token it carries, or the challenge that sends an
 * AI app through sign-in and consent when the token is missing, expired or revoked; a 404 off HTTPS.
 */
export async function handleMcpRequest(
	request: Request,
	url: URL,
): Promise<Response> {
	const resource = mcpResource(publicOrigin() ?? url.origin);
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
		const info = await verifyBearerToken(request.headers.get("authorization"), {
			...challenge,
			expectedResource: resourceUrl,
			verifier: { verifyAccessToken: (token) => verify(token, resourceUrl) },
		});
		userId = String(info.extra?.userId);
	} catch (error) {
		return bearerAuthChallengeResponse(error, challenge);
	}
	return createMcpHandler(() => serverFor(userId)).fetch(request);
}
