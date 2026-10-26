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
