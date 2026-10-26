<script lang="ts">
	import DownloadIcon from "@lucide/svelte/icons/download";
	import ShareIcon from "@lucide/svelte/icons/share";
	import SquarePlusIcon from "@lucide/svelte/icons/square-plus";
	import { onMount } from "svelte";

	import BrandMark from "#lib/components/brand-mark.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";

	interface InstallPromptEvent extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
	}

	const storageKey = "opencount-install-prompted";

	let open = $state(false);
	let mode = $state<"native" | "apple">("native");
	let deferred: InstallPromptEvent | undefined;

	function alreadyPrompted(): boolean {
		try {
			return localStorage.getItem(storageKey) !== null;
		} catch {
			return true;
		}
	}

	function show(next: "native" | "apple") {
		if (alreadyPrompted()) {
			return;
		}
		mode = next;
		open = true;
		try {
			localStorage.setItem(storageKey, new Date().toISOString());
		} catch {
			open = false;
		}
	}

	onMount(() => {
		const standalone =
			matchMedia("(display-mode: standalone)").matches ||
			("standalone" in navigator && navigator.standalone === true);
		if (standalone || alreadyPrompted()) {
			return;
		}
		const apple =
			/iPhone|iPad/.test(navigator.userAgent) &&
			/Safari\//.test(navigator.userAgent) &&
			!/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
		if (apple) {
			const timer = setTimeout(() => show("apple"), 1500);
			return () => clearTimeout(timer);
		}
		const capture = (event: Event) => {
			event.preventDefault();
			deferred = event as InstallPromptEvent;
			show("native");
		};
		addEventListener("beforeinstallprompt", capture);
		return () => removeEventListener("beforeinstallprompt", capture);
	});

	async function install() {
		open = false;
		await deferred?.prompt();
		deferred = undefined;
	}
</script>

<ResponsiveSheet
	bind:open
	title="Install OpenCount"
	description="Open it from your home screen like any app: full screen, quicker to reach, and with notifications."
>
	<div class="flex flex-col gap-5 pb-4">
		<div class="flex justify-center py-2">
			<BrandMark class="size-16 drop-shadow-lg" />
		</div>
		{#if mode === "apple"}
			<ol class="flex flex-col gap-3 text-sm">
				<li class="flex items-center gap-3">
					<span
						class="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-xl"
						><ShareIcon class="size-4" /></span
					>
					Tap Share in Safari's toolbar.
				</li>
				<li class="flex items-center gap-3">
					<span
						class="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-xl"
						><SquarePlusIcon class="size-4" /></span
					>
					Pick Add to Home Screen, then Add.
				</li>
			</ol>
			<Button class="h-12 rounded-xl text-base" onclick={() => (open = false)}
				>Got it</Button
			>
		{:else}
			<Button class="glow h-12 rounded-xl text-base" onclick={install}>
				<DownloadIcon />
				Install
			</Button>
			<Button
				variant="ghost"
				class="h-11 rounded-xl"
				onclick={() => (open = false)}>Not now</Button
			>
		{/if}
	</div>
</ResponsiveSheet>
