import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

import { getAuth } from "#lib/server/auth.js";

export const GET = ({ request }) =>
	oauthProviderOpenIdConfigMetadata(getAuth())(request);
