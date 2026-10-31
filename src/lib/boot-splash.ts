import { invalidateAll } from "$app/navigation";
import { resolve } from "$app/paths";

/** Fades out the launch splash drawn by `app.html` on the next frame, then removes it from the page. */
export function dismissBootSplash(): void {
	const splash = document.getElementById("boot-splash");
	if (!splash) {
		return;
	}
	requestAnimationFrame(() => {
		splash.dataset.leaving = "";
		splash.addEventListener("transitionend", () => splash.remove(), {
			once: true,
		});
		setTimeout(() => splash.remove(), 600);
	});
}

/** Reloads the page's data once the server answers, after a boot the service worker served from its cache; offline it does nothing. */
export async function refreshAfterCachedBoot(): Promise<void> {
	const root = document.documentElement;
	if (!("bootCache" in root.dataset)) {
		return;
	}
	delete root.dataset.bootCache;
	const health = await fetch(resolve("/api/health"), {
		cache: "no-store",
	}).catch(() => null);
	if (health?.ok) {
		await invalidateAll();
	}
}
