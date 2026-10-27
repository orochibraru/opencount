import { handleMcpRequest } from "#lib/server/mcp.js";

export const POST = ({ request, url }) => handleMcpRequest(request, url);

export const GET = ({ request, url }) => handleMcpRequest(request, url);
