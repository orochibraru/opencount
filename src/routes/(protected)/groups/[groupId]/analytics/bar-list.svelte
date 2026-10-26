<script lang="ts">
	import type { Component } from "svelte";

	import { formatMoney } from "#lib/money.js";

	interface Props {
		title: string;
		rows: {
			key: string;
			label: string;
			totalMinor: number;
			icon?: Component<{ class?: string }>;
			colour?: string;
		}[];
		currency: string;
		empty: string;
	}

	const { title, rows, currency, empty }: Props = $props();

	const largest = $derived(Math.max(1, ...rows.map((row) => row.totalMinor)));
	const total = $derived(rows.reduce((sum, row) => sum + row.totalMinor, 0));
</script>

<section class="glass flex flex-col gap-4 rounded-2xl p-4 md:p-5">
	<h2 class="font-semibold">{title}</h2>
	{#if rows.length === 0}
		<p class="text-muted-foreground text-sm">{empty}</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each rows as row (row.key)}
				<li class="flex flex-col gap-1.5">
					<div class="flex items-center gap-2 text-sm">
						{#if row.icon}
							<span
								class="category-tile flex size-6 shrink-0 items-center justify-center rounded-md"
								style={row.colour}
							>
								<row.icon class="size-3.5" />
							</span>
						{/if}
						<span class="min-w-0 flex-1 truncate">{row.label}</span>
						<span class="text-muted-foreground tabular text-xs"
							>{Math.round((row.totalMinor / Math.max(total, 1)) * 100)}%</span
						>
						<span class="w-24 text-right font-medium tabular"
							>{formatMoney(row.totalMinor, currency)}</span
						>
					</div>
					<div
						class="bg-muted h-2 overflow-hidden rounded-full"
						aria-hidden="true"
					>
						<div
							class="h-full rounded-full {row.colour
								? 'category-bar'
								: 'bg-primary'}"
							style="width: {Math.max(
								2,
								(row.totalMinor / largest) * 100,
							)}%; {row.colour ?? ''}"
						></div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
