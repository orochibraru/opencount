<script lang="ts" module>
	export interface FilterSource {
		value: string;
		label: string;
		indent?: boolean;
	}

	export interface FilterChange {
		categories?: string[];
		sources?: string[];
		folder?: string | null;
		merchants?: string[];
		search?: string;
	}
</script>

<script lang="ts">
	import { goto } from "$app/navigation";
	import CheckIcon from "@lucide/svelte/icons/check";
	import FolderIcon from "@lucide/svelte/icons/folder";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import ListFilterIcon from "@lucide/svelte/icons/list-filter";
	import SearchIcon from "@lucide/svelte/icons/search";
	import StoreIcon from "@lucide/svelte/icons/store";
	import XIcon from "@lucide/svelte/icons/x";
	import type { Snippet } from "svelte";

	import { type CategoryOption, categoryStyle } from "#lib/categories.js";
	import IconButton from "#lib/components/icon-button.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { toggled } from "#lib/filter-params.js";

	interface Props {
		search: string;
		options: CategoryOption[];
		categories: string[];
		sources?: FilterSource[];
		activeSources?: string[];
		folders?: FilterSource[];
		activeFolder?: string | null;
		merchants?: FilterSource[];
		activeMerchants?: string[];
		href: (change: FilterChange) => string;
	}

	const {
		search,
		options,
		categories,
		sources = [],
		activeSources = [],
		folders = [],
		activeFolder = null,
		merchants = [],
		activeMerchants = [],
		href,
	}: Props = $props();

	let open = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	let pickedCategories = $derived(categories);
	let pickedSources = $derived(activeSources);
	let pickedMerchants = $derived(activeMerchants);

	function searchFor(text: string) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			void goto(href({ search: text.trim() }), {
				replace: true,
				reset: false,
			});
		}, 300);
	}

	function apply(change: FilterChange) {
		pickedCategories = change.categories ?? pickedCategories;
		pickedSources = change.sources ?? pickedSources;
		pickedMerchants = change.merchants ?? pickedMerchants;
		void goto(
			href({
				categories: pickedCategories,
				sources: pickedSources,
				merchants: pickedMerchants,
				...(change.folder === undefined ? {} : { folder: change.folder }),
			}),
			{ replace: true, reset: false },
		);
	}

	const firstCategory = $derived(
		options.find((option) => option.value === pickedCategories[0]),
	);
	const labels = $derived([
		...folders
			.filter((entry) => entry.value === activeFolder)
			.map((entry) => entry.label),
		...merchants
			.filter((entry) => pickedMerchants.includes(entry.value))
			.map((entry) => entry.label),
		...options
			.filter((option) => pickedCategories.includes(option.value))
			.map((option) => option.label),
		...sources
			.filter((entry) => pickedSources.includes(entry.value))
			.map((entry) => entry.label),
	]);
	const label = $derived(
		labels.length > 1
			? `${labels[0]} +${labels.length - 1}`
			: (labels[0] ?? ""),
	);
	const filtering = $derived(labels.length > 0);
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
		aria-label={filtering ? `Filtered by ${labels.join(", ")}` : "Filter"}
		onclick={() => (open = true)}
	>
		{#if firstCategory}
			<span
				class="category-tile flex size-6 shrink-0 items-center justify-center rounded-md"
				style={categoryStyle(firstCategory)}
			>
				<firstCategory.icon class="size-3.5" />
			</span>
		{:else if pickedSources.length > 0}
			<LandmarkIcon />
		{:else if activeFolder}
			<FolderIcon />
		{:else if pickedMerchants.length > 0}
			<StoreIcon />
		{:else}
			<ListFilterIcon />
		{/if}
		<span class="truncate">{label || "Filter"}</span>
	</Button>
	{#if filtering}
		<IconButton
			label="Clear the filters"
			icon={XIcon}
			href={href({
				categories: [],
				sources: [],
				folder: null,
				merchants: [],
			})}
			data-sveltekit-reset="false"
		/>
	{/if}
</div>

{#snippet choice(
	change: FilterChange,
	selected: boolean,
	text: string,
	indent: boolean,
	tile: Snippet,
)}
	<li>
		<button
			type="button"
			aria-pressed={selected}
			onclick={() => apply(change)}
			class="hover:bg-muted flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left {indent
				? 'pl-8'
				: ''} {selected ? 'bg-muted font-medium' : ''}"
		>
			{@render tile()}
			<span class="min-w-0 flex-1 truncate">{text}</span>
			{#if selected}
				<CheckIcon class="text-primary size-4 shrink-0" />
			{/if}
		</button>
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

{#snippet merchantTile()}
	<span
		class="category-tile flex size-9 items-center justify-center rounded-lg"
		style="--category-chroma: 0"
	>
		<StoreIcon class="size-4" />
	</span>
{/snippet}

{#snippet folderTile()}
	<span
		class="category-tile flex size-9 items-center justify-center rounded-lg"
		style="--category-chroma: 0"
	>
		<FolderIcon class="size-4" />
	</span>
{/snippet}

<ResponsiveSheet
	bind:open
	title="Filter"
	description="Pick as many as you like: any of them in a section, every section at once."
>
	<div class="flex flex-col gap-4 pb-4">
		{#if folders.length > 0}
			<section aria-labelledby="filter-folders">
				<h3
					id="filter-folders"
					class="text-muted-foreground mb-1 px-2 text-sm font-medium"
				>
					Folders
				</h3>
				<ul class="flex flex-col gap-1">
					{@render choice(
						{ folder: null },
						!activeFolder,
						"Every folder",
						false,
						neutralTile,
					)}
					{#each folders as folder (folder.value)}
						{@render choice(
							{ folder: folder.value },
							activeFolder === folder.value,
							folder.label,
							false,
							folderTile,
						)}
					{/each}
				</ul>
			</section>
		{/if}
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
						{ sources: [] },
						pickedSources.length === 0,
						"Every account",
						false,
						neutralTile,
					)}
					{#each sources as source (source.value)}
						{@render choice(
							{ sources: toggled(pickedSources, source.value) },
							pickedSources.includes(source.value),
							source.label,
							source.indent ?? false,
							bankTile,
						)}
					{/each}
				</ul>
			</section>
		{/if}
		{#if merchants.length > 0}
			<section aria-labelledby="filter-merchants">
				<h3
					id="filter-merchants"
					class="text-muted-foreground mb-1 px-2 text-sm font-medium"
				>
					Merchants
				</h3>
				<ul class="flex flex-col gap-1">
					{@render choice(
						{ merchants: [] },
						pickedMerchants.length === 0,
						"Every merchant",
						false,
						neutralTile,
					)}
					{#each merchants as merchant (merchant.value)}
						{@render choice(
							{ merchants: toggled(pickedMerchants, merchant.value) },
							pickedMerchants.includes(merchant.value),
							merchant.label,
							false,
							merchantTile,
						)}
					{/each}
				</ul>
			</section>
		{/if}
		<section aria-labelledby="filter-categories">
			{#if sources.length > 0 || folders.length > 0 || merchants.length > 0}
				<h3
					id="filter-categories"
					class="text-muted-foreground mb-1 px-2 text-sm font-medium"
				>
					Categories
				</h3>
			{/if}
			<ul class="flex flex-col gap-1" aria-label="Categories">
				{@render choice(
					{ categories: [] },
					pickedCategories.length === 0,
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
						{ categories: toggled(pickedCategories, option.value) },
						pickedCategories.includes(option.value),
						option.label,
						false,
						optionTile,
					)}
				{/each}
			</ul>
		</section>
		<div
			class="bg-background sticky bottom-0 -mx-1 flex gap-2 px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
		>
			{#if filtering}
				<Button
					variant="secondary"
					class="h-11 flex-1 rounded-xl"
					onclick={() => apply({ categories: [], sources: [], merchants: [] })}
				>
					Clear
				</Button>
			{/if}
			<Button class="h-11 flex-1 rounded-xl" onclick={() => (open = false)}>
				Done
			</Button>
		</div>
	</div>
</ResponsiveSheet>
