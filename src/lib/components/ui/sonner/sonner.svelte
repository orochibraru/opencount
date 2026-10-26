<script lang="ts">
	import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
	import InfoIcon from "@lucide/svelte/icons/info";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import OctagonXIcon from "@lucide/svelte/icons/octagon-x";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import { mode } from "mode-watcher";
	import {
		Toaster as Sonner,
		type ToasterProps as SonnerProps,
	} from "svelte-sonner";
	import { MediaQuery } from "svelte/reactivity";

	let { ...restProps }: SonnerProps = $props();

	const desktop = new MediaQuery("(min-width: 768px)");
</script>

<Sonner
	theme={mode.current}
	class="toaster group"
	position={desktop.current ? "top-right" : "bottom-center"}
	closeButton
	closeButtonAriaLabel="Dismiss"
	offset={{ top: "4.75rem", right: "1.5rem" }}
	mobileOffset={{
		bottom: "calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.75rem)",
		left: "0.75rem",
		right: "0.75rem",
	}}
	style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border); --border-radius: var(--radius-xl);"
	toastOptions={{
		classes: {
			toast: "cn-toast",
			description: "cn-toast-description",
			closeButton: "cn-toast-close",
			success: "cn-toast-success",
			error: "cn-toast-error",
			warning: "cn-toast-warning",
			info: "cn-toast-info",
		},
	}}
	{...restProps}
>
	{#snippet loadingIcon()}
		<Loader2Icon class="text-muted-foreground size-4 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<CircleCheckIcon class="text-positive size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<OctagonXIcon class="text-destructive size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="text-primary size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="size-4 text-amber-500" />
	{/snippet}
</Sonner>
