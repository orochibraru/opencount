import { deserialize } from "$app/forms";
import { invalidateAll } from "$app/navigation";

export interface QueuedExpense {
	id: string;
	groupId: string;
	action: string;
	description: string;
	fields: [string, string][];
	createdAt: number;
}

export interface SyncResult {
	synced: number;
	rejected: string[];
}

const databaseName = "opencount";
const storeName = "queued-expenses";

function settle<Result>(request: IDBRequest<Result>): Promise<Result> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("IndexedDB failed"));
	});
}

async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
	const opening = indexedDB.open(databaseName, 1);
	opening.onupgradeneeded = () =>
		opening.result.createObjectStore(storeName, { keyPath: "id" });
	const database = await settle(opening);
	return database.transaction(storeName, mode).objectStore(storeName);
}

class OfflineQueue {
	pending = $state<QueuedExpense[]>([]);
	#syncing = false;

	/** Reloads the queued expenses from IndexedDB into `pending`. */
	async load(): Promise<void> {
		this.pending = await settle(
			(await store("readonly")).getAll() as IDBRequest<QueuedExpense[]>,
		);
	}

	/** Keeps a new expense form, submitted while offline, to post to `action` later. */
	async add(
		groupId: string,
		action: string,
		formData: FormData,
	): Promise<void> {
		const fields = [...formData].filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		);
		await settle(
			(await store("readwrite")).put({
				id: crypto.randomUUID(),
				groupId,
				action,
				description: String(formData.get("description") ?? "Expense"),
				fields,
				createdAt: Date.now(),
			} satisfies QueuedExpense),
		);
		await this.load();
	}

	/**
	 * Posts every queued expense, oldest first. One the server saves or refuses as invalid is forgotten; a network
	 * failure, a server error or a lost session stops the run and keeps the rest for next time.
	 */
	async sync(): Promise<SyncResult> {
		const result: SyncResult = { synced: 0, rejected: [] };
		if (this.#syncing) {
			return result;
		}
		this.#syncing = true;
		try {
			await this.load();
			for (const entry of this.pending.toSorted(
				(left, right) => left.createdAt - right.createdAt,
			)) {
				const body = new FormData();
				for (const [name, value] of entry.fields) {
					body.append(name, value);
				}
				const response = await fetch(entry.action, {
					method: "POST",
					body,
					headers: { "x-sveltekit-action": "true" },
				});
				const outcome = deserialize(await response.text());
				if (
					outcome.type === "error" ||
					(outcome.type === "failure" && outcome.status === 401)
				) {
					break;
				}
				if (outcome.type === "failure") {
					result.rejected.push(entry.description);
				} else {
					result.synced += 1;
				}
				await settle((await store("readwrite")).delete(entry.id));
			}
		} finally {
			this.#syncing = false;
			await this.load();
		}
		if (result.synced > 0) {
			await invalidateAll();
		}
		return result;
	}
}

export const offlineQueue = new OfflineQueue();
