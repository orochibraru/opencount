const storageKey = "count-shared-accounts";

/** What this device last chose, false when it never chose or storage is out of reach. */
function stored(): boolean {
	try {
		return (
			typeof localStorage !== "undefined" &&
			localStorage.getItem(storageKey) === "true"
		);
	} catch {
		return false;
	}
}

/** Whether this device counts shared accounts in balance totals: off until someone switches it on, kept per device. */
class CountShared {
	#on = $state(stored());

	/** Whether shared accounts count on this device. */
	get on(): boolean {
		return this.#on;
	}

	/** Counts shared accounts in totals on this device, or stops, and remembers it. */
	set on(value: boolean) {
		this.#on = value;
		try {
			localStorage.setItem(storageKey, String(value));
		} catch {
			return;
		}
	}
}

export const countShared = new CountShared();
