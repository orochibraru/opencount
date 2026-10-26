/**
 * Forgets every page, piece of data and queued expense kept on this device for offline use, so the next person sees
 * none of it.
 */
export async function clearCachedPages(): Promise<void> {
	if ("indexedDB" in globalThis) {
		indexedDB.deleteDatabase("opencount");
	}
	if (!("caches" in globalThis)) {
		return;
	}
	const keys = await caches.keys();
	await Promise.all(
		keys
			.filter((key) => key.startsWith("opencount-pages-"))
			.map((key) => caches.delete(key)),
	);
}
