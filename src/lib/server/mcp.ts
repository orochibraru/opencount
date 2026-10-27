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
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { minorToDecimal } from "#lib/money.js";
import { getAuth } from "#lib/server/auth.js";
import { getConfig } from "#lib/server/config.js";

const jwksCacheKey = {};

function categoriesFor(userId: string): { id: string; name: string }[] {
	return [
		...Object.entries(categoryLabels).map(([id, name]) => ({ id, name })),
		...PersonalCategoryDTO.forUser(userId).map((entry) => {
			const { id, name } = entry.toJSON();
			return { id, name };
		}),
	];
}

function reply(value: unknown) {
	return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function serverFor(userId: string): McpServer {
	const server = new McpServer({
		name: "OpenCount",
		version: getConfig().appVersion,
	});
	server.registerTool(
		"list_categories",
		{
			title: "List categories",
			description:
				"The categories a personal expense can be filed under: the built-in ones and the person's own, each with the id set_categories expects.",
			annotations: { readOnlyHint: true },
		},
		() => reply({ categories: categoriesFor(userId) }),
	);
	server.registerTool(
		"list_expenses",
		{
			title: "List personal expenses",
			description:
				"The person's personal expenses and income, latest first: id, description, amount, currency, date, kind and category. Uncategorized ones (category other) only, unless uncategorizedOnly is false.",
			inputSchema: z.object({
				uncategorizedOnly: z.boolean().default(true),
				limit: z.number().int().min(1).max(200).default(100),
				offset: z.number().int().min(0).default(0),
			}),
			annotations: { readOnlyHint: true },
		},
		({ uncategorizedOnly, limit, offset }) => {
			const page = PersonalExpenseDTO.page(userId, {
				limit,
				offset,
				category: uncategorizedOnly ? "other" : undefined,
			});
			return reply({
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
			});
		},
	);
	server.registerTool(
		"set_categories",
		{
			title: "Categorize personal expenses",
			description:
				"Files personal expenses under categories, up to 200 at once. Each category is an id from list_categories; an unknown one is skipped and named back.",
			inputSchema: z.object({
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
		({ changes }) => {
			const known = new Set(categoriesFor(userId).map((entry) => entry.id));
			const byCategory = Map.groupBy(changes, (change) => change.category);
			let updated = 0;
			for (const [category, entries] of byCategory) {
				if (known.has(category)) {
					updated += PersonalExpenseDTO.recategorize(
						userId,
						entries.map((entry) => entry.id),
						category,
					);
				}
			}
			return reply({
				updated,
				unknownCategories: [...byCategory.keys()].filter(
					(category) => !known.has(category),
				),
			});
		},
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
 * Answers one MCP request to `resource` for the person whose access token it carries, or the challenge that sends an
 * AI app through sign-in and consent when the token is missing, expired or revoked.
 */
export async function handleMcpRequest(
	request: Request,
	resource: string,
): Promise<Response> {
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
