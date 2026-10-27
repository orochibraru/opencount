import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { getAuth } from "#lib/server/auth.js";

export const GET = ({ request }) =>
	oauthProviderAuthServerMetadata(getAuth())(request);
