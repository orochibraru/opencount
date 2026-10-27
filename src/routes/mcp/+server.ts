import { error } from "@sveltejs/kit";

import { mcpResource, publicOrigin } from "#lib/server/auth.js";
import { handleMcpRequest } from "#lib/server/mcp.js";

export const POST = ({ request, url }) => {
	const resource = mcpResource(publicOrigin() ?? url.origin);
	if (!resource) {
		error(404, "AI apps need this server on HTTPS.");
	}
	return handleMcpRequest(request, resource);
};
