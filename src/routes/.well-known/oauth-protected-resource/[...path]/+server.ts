import { getAuth } from "#lib/server/auth.js";

export const GET = ({ request }) => getAuth().handler(request);
