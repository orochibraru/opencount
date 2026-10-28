import { command, getRequestEvent } from "$app/server";

import { access } from "#lib/server/auth/access.js";
import { appLock } from "#lib/server/auth/app-lock.js";

export const lockApp = command(() => {
	access.requireUser();
	const { session } = getRequestEvent().locals;
	if (session) {
		appLock.lock(session.id);
	}
});

export const keepUnlocked = command(() => {
	access.requireUser();
});
