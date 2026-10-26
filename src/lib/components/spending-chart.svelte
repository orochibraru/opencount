<script lang="ts">
	import { type Bucket } from "#lib/analytics.js";
	import { formatMoney } from "#lib/money.js";
	import { cn } from "#lib/utils.js";

	interface Props {
		overTime: { key: string; totalMinor: number }[];
		bucket: Bucket;
		totalMinor: number;
		currency: string;
		title?: string;
	}

	const {
		overTime,
		bucket,
		totalMinor,
		currency,
		title = "Over time",
	}: Props = $props();

	const largest = $derived(
		Math.max(1, ...overTime.map((entry) => entry.totalMinor)),
	);
	const average = $derived(
		overTime.length > 0 ? Math.round(totalMinor / overTime.length) : 0,
	);

	const bucketNames: Record<Bucket, string> = {
		day: "day",
		week: "week",
		month: "month",
	};

	function bucketLabel(key: string, kind: Bucket, long = false): string {
		const date = new Date(`${kind === "month" ? `${key}-01` : key}T12:00:00`);
		if (kind === "month") {
			return date.toLocaleDateString(undefined, {
				month: long ? "long" : "short",
				year: long ? "numeric" : undefined,
			});
		}
		const day = date.toLocaleDateString(undefined, {
			day: "numeric",
			month: "short",
		});
		return kind === "week" && long ? `Week of ${day}` : day;
	}

	function showTick(index: number, count: number): boolean {
		const step = Math.ceil(count / 8);
		return (
			index === count - 1 || (index % step === 0 && count - 1 - index >= step)
		);
	}
</script>

<section class="glass mt-4 flex flex-col gap-4 rounded-2xl p-4 md:mt-6 md:p-5">
	<div class="flex items-baseline justify-between gap-3">
		<h2 class="font-semibold">{title}</h2>
		<p class="text-muted-foreground text-sm">
			{formatMoney(average, currency)} per {bucketNames[bucket]} on average
		</p>
	</div>
	<div class="flex h-48 items-end gap-0.5 md:h-56" role="presentation">
		{#each overTime as entry (entry.key)}
			<div class="group relative flex h-full min-w-0 flex-1 items-end">
				<div
					class={cn(
						"w-full rounded-t-sm transition-colors",
						entry.totalMinor > 0
							? "bg-primary group-hover:bg-primary/80"
							: "bg-muted",
					)}
					style="height: {entry.totalMinor > 0
						? Math.max(2, (entry.totalMinor / largest) * 100)
						: 1}%"
				></div>
				<div
					class="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md group-hover:block"
				>
					<span class="text-muted-foreground block"
						>{bucketLabel(entry.key, bucket, true)}</span
					>
					<span class="font-medium tabular"
						>{formatMoney(entry.totalMinor, currency)}</span
					>
				</div>
			</div>
		{/each}
	</div>
	<div
		class="text-muted-foreground -mt-2 flex gap-0.5 text-[0.7rem]"
		aria-hidden="true"
	>
		{#each overTime as entry, index (entry.key)}
			<span
				class="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap"
				>{showTick(index, overTime.length)
					? bucketLabel(entry.key, bucket)
					: ""}</span
			>
		{/each}
	</div>
	<table class="sr-only">
		<caption>Spending per {bucketNames[bucket]}</caption>
		<tbody>
			{#each overTime as entry (entry.key)}
				<tr>
					<th scope="row">{bucketLabel(entry.key, bucket, true)}</th>
					<td>{formatMoney(entry.totalMinor, currency)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>
