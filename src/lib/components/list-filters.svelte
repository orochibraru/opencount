<script lang="ts" module>
	export interface FilterSource {
		value: string;
		label: string;
		indent?: boolean;
	}

	export interface FilterChange {
		category?: string | null;
		source?: string | null;
		search?: string;
	}
</script>

<script lang="ts">
	import { goto } from "$app/navigation";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import ListFilterIcon from "@lucide/svelte/icons/list-filter";
	import SearchIcon from "@lucide/svelte/icons/search";
	import XIcon from "@lucide/svelte/icons/x";
	import type { Snippet } from "svelte";

	import { type CategoryOption, categoryStyle } from "#lib/categories.js";
	import IconButton from "#lib/components/icon-button.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";

	interface Props {
		search: string;
		active: CategoryOption | undefined;
		options: CategoryOption[];
		sources?: FilterSource[];
		activeSource?: FilterSource;
		href: (change: FilterChange) => string;
	}

	const {
		search,
		active,
		options,
		sources = [],
		activeSource,
		href,
	}: Props = $props();

	let open = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function searchFor(text: string) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			void goto(href({ search: text.trim() }), {
				replace: true,
				reset: false,
			});
		}, 300);
	}

	const label = $derived(
		[active?.label, activeSource?.label].filter(Boolean).join(" · "),
	);
</script>

<div class="mb-4 flex items-center gap-2">
	<label class="relative min-w-0 flex-1">
		<span class="sr-only">Search expenses</span>
		<SearchIcon
			class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
		/>
		<Input
			type="search"
			value={search}
			placeholder="Search"
			autocomplete="off"
			oninput={(event) => searchFor(event.currentTarget.value)}
			class="h-11 rounded-xl pl-9"
		/>
	</label>
	<Button
		variant="secondary"
		class="h-11 max-w-[45%] shrink-0 rounded-xl"
		aria-label={label ? `Filtered by ${label}` : "Filter"}
		onclick={() => (open = true)}
	>
		{#if active}
			<span
				class="category-tile flex size-6 shrink-0 items-center justify-center rounded-md"
				style={categoryStyle(active)}
			>
				<active.icon class="size-3.5" />
			</span>
		{:else if activeSource}
			<LandmarkIcon />
		{:else}
			<ListFilterIcon />
		{/if}
		<span class="truncate">{label || "Filter"}</span>
	</Button>
	{#if active || activeSource}
		<IconButton
			label="Clear the filters"
			icon={XIcon}
			href={href({ category: null, source: null })}
			data-sveltekit-reset="false"
		/>
	{/if}
</div>

{#snippet choice(
	link: string,
	selected: boolean,
	text: string,
	indent: boolean,
	tile: Snippet,
)}
	<li>
		<a
			href={link}
			data-sveltekit-reset="false"
			onclick={() => (open = false)}
			class="hover:bg-muted flex min-h-12 items-center gap-3 rounded-xl px-2 {indent
				? 'pl-8'
				: ''} {selected ? 'bg-muted font-medium' : ''}"
		>
			{@render tile()}
			{text}
		</a>
	</li>
{/snippet}

{#snippet neutralTile()}
	<span
		class="category-tile flex size-9 items-center justify-center rounded-lg"
		style="--category-chroma: 0"
	>
		<ListFilterIcon class="size-4" />
	</span>
{/snippet}

{#snippet bankTile()}
	<span
		class="category-tile flex size-9 items-center justify-center rounded-lg"
		style="--category-chroma: 0"
	>
		<LandmarkIcon class="size-4" />
	</span>
{/snippet}

<ResponsiveSheet bind:open title="Filter">
	<div class="flex flex-col gap-4 pb-4">
		{#if sources.length > 0}
			<section aria-labelledby="filter-sources">
				<h3
					id="filter-sources"
					class="text-muted-foreground mb-1 px-2 text-sm font-medium"
				>
					Bank accounts
				</h3>
				<ul class="flex flex-col gap-1">
					{@render choice(
						href({ source: null }),
						!activeSource,
						"Every account",
						false,
						neutralTile,
					)}
					{#each sources as source (source.value)}
						{@render choice(
							href({ source: source.value }),
							activeSource?.value === source.value,
							source.label,
							source.indent ?? false,
							bankTile,
						)}
					{/each}
				</ul>
			</section>
		{/if}
		<section aria-labelledby="filter-categories">
			{#if sources.length > 0}
				<h3
					id="filter-categories"
					class="text-muted-foreground mb-1 px-2 text-sm font-medium"
				>
					Categories
				</h3>
			{/if}
			<ul class="flex flex-col gap-1" aria-label="Categories">
				{@render choice(
					href({ category: null }),
					!active,
					"Every category",
					false,
					neutralTile,
				)}
				{#each options as option (option.value)}
					{#snippet optionTile()}
						<span
							class="category-tile flex size-9 items-center justify-center rounded-lg"
							style={categoryStyle(option)}
						>
							<option.icon class="size-4" />
						</span>
					{/snippet}
					{@render choice(
						href({ category: option.value }),
						active?.value === option.value,
						option.label,
						false,
						optionTile,
					)}
				{/each}
			</ul>
		</section>
	</div>
</ResponsiveSheet>
