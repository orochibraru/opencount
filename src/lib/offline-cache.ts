/** Forgets every page and piece of data the service worker kept for offline use, so the next person sees none of it. */
export async function clearCachedPages(): Promise<void> {
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
