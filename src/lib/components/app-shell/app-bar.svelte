<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";

	import BrandMark from "#lib/components/brand-mark.svelte";
	import IconButton from "#lib/components/icon-button.svelte";
	import { usePageTitle } from "#lib/page-title.svelte.js";

	const title = usePageTitle();
	const mobileActions = $derived(
		title.actions.filter((action) => !action.primary),
	);

	let scrolled = $state(false);
</script>

<svelte:window onscroll={() => (scrolled = window.scrollY > 8)} />

<svelte:head>
	<title
		>{title.current && title.current !== "OpenCount"
			? `${title.current} | OpenCount`
			: "OpenCount"}</title
	>
</svelte:head>

<header
	class="bg-chrome pt-safe-top fixed inset-x-0 top-0 z-40 border-b backdrop-blur-2xl backdrop-saturate-150 transition-[border-color,box-shadow] duration-300 md:hidden {scrolled
		? 'border-border shadow-[0_8px_24px_-16px_var(--glass-shadow)]'
		: 'border-transparent'}"
	style="view-transition-name: app-bar"
>
	<div
		class="relative flex h-14 items-center justify-center {mobileActions.length >
		1
			? 'px-26'
			: 'px-14'}"
	>
		{#if title.backHref}
			<div class="absolute top-1/2 left-1.5 -translate-y-1/2">
				<IconButton label="Back" icon={ChevronLeftIcon} href={title.backHref} />
			</div>
		{:else if page.url.pathname === resolve("/(protected)")}
			<BrandMark class="absolute top-1/2 left-3.5 -translate-y-1/2" />
		{/if}
		<h1 class="truncate text-[1.0625rem] font-semibold">{title.current}</h1>
		{#if mobileActions.length > 0}
			<div class="absolute top-1/2 right-1.5 flex -translate-y-1/2">
				{#each mobileActions as action (action.label)}
					<IconButton
						label={action.label}
						icon={action.icon}
						href={action.href}
						onclick={action.onSelect}
					/>
				{/each}
			</div>
		{/if}
	</div>
</header>
