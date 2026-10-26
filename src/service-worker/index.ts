import { version } from "$app/env";
import { assets, immutable, prerendered } from "$app/manifest";
import { self as worker } from "$app/service-worker";

const cacheName = `opencount-${version}`;
const precached = new Set(
	[...immutable, ...assets, ...prerendered]
		.map((entry) => `/${entry.path}`.replace(/^\/+/, "/"))
		.filter(
			(path) => !path.split("/").some((segment) => segment.startsWith(".")),
		),
);

worker.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(cacheName)
			.then((cache) => cache.addAll([...precached]))
			.then(() => worker.skipWaiting()),
	);
});

worker.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== cacheName)
						.map((key) => caches.delete(key)),
				),
			)
			.then(() => worker.clients.claim()),
	);
});

worker.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);
	if (
		event.request.method !== "GET" ||
		url.origin !== worker.location.origin ||
		!precached.has(url.pathname)
	) {
		return;
	}
	event.respondWith(
		caches
			.open(cacheName)
			.then(
				async (cache) =>
					(await cache.match(url.pathname)) ?? fetch(event.request),
			),
	);
});

worker.addEventListener("push", (event) => {
	const payload = (event.data?.json() ?? {}) as {
		title?: string;
		body?: string;
		url?: string;
	};
	event.waitUntil(
		worker.registration.showNotification(payload.title ?? "OpenCount", {
			body: payload.body,
			icon: "/pwa-192x192.png",
			badge: "/pwa-64x64.png",
			data: { url: payload.url ?? "/" },
		}),
	);
});

worker.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const target = new URL(
		String((event.notification.data as { url?: string } | null)?.url ?? "/"),
		worker.location.origin,
	);
	event.waitUntil(
		worker.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then(async (windows) => {
				const open = windows.find(
					(client) => new URL(client.url).origin === target.origin,
				);
				if (open) {
					await open.focus();
					await open.navigate(target.href);
					return;
				}
				await worker.clients.openWindow(target.href);
			}),
	);
});
