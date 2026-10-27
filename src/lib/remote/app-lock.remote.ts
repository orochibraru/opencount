import { command, getRequestEvent } from "$app/server";

import { appLock } from "#lib/server/app-lock.js";
import { requireUser } from "#lib/server/remote-auth.js";

export const lockApp = command(() => {
	requireUser();
	const { session } = getRequestEvent().locals;
	if (session) {
		appLock.lock(session.id);
	}
});

export const keepUnlocked = command(() => {
	requireUser();
});
