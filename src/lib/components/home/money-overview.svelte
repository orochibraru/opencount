<script lang="ts">
	import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
	import RepeatIcon from "@lucide/svelte/icons/repeat";
	import SunriseIcon from "@lucide/svelte/icons/sunrise";
	import TrendingUpIcon from "@lucide/svelte/icons/trending-up";

	import {
		categoryOf,
		categoryStyle,
		type CustomCategory,
	} from "#lib/categories.js";
	import SpendingChart from "#lib/components/spending-chart.svelte";
	import type { MoneyOverview } from "#lib/money-overview.js";
	import { formatMoney } from "#lib/money.js";

	interface Props {
		overview: MoneyOverview & {
			syncedAt: Date | null;
			categories: CustomCategory[];
		};
	}

	const { overview }: Props = $props();

	const money = (minor: number) => formatMoney(minor, overview.currency);
	const leftOver = $derived(
		overview.incomeMinor - overview.spentMinor - overview.asideMinor,
	);
	const pace = $derived(overview.spentMinor - overview.lastMonthSoFarMinor);
	const top = $derived(
		overview.topCategory
			? categoryOf(overview.topCategory.category, overview.categories)
			: undefined,
	);
	const topChange = $derived(
		overview.topCategory && overview.topCategory.lastMonthMinor > 0
			? Math.round(
					(overview.topCategory.totalMinor /
						overview.topCategory.lastMonthMinor -
						1) *
						100,
				)
			: null,
	);
	const recurringTotal = $derived(
		overview.recurring.reduce((total, entry) => total + entry.amountMinor, 0),
	);

	function day(value: string, options: Intl.DateTimeFormatOptions): string {
		return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, options);
	}

	function synced(date: Date | null): string {
		if (!date) {
			return "Waiting for the first sync";
		}
		const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
		const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
		if (minutes < 60) {
			return `Synced ${format.format(-minutes, "minute")}`;
		}
		if (minutes < 48 * 60) {
			return `Synced ${format.format(-Math.round(minutes / 60), "hour")}`;
		}
		return `Synced ${format.format(-Math.round(minutes / 1_440), "day")}`;
	}
</script>

<section class="flex flex-col gap-4" aria-label="Your money">
	<p class="text-muted-foreground px-1 text-sm">{synced(overview.syncedAt)}</p>

	<div class="grid gap-4 lg:grid-cols-3">
		<article class="glass rounded-3xl p-5 md:p-6 lg:col-span-2">
			<p class="text-muted-foreground text-sm">
				{overview.monthStart.endsWith("-01")
					? `Spent in ${day(overview.today, { month: "long" })}`
					: `Spent since ${day(overview.monthStart, { day: "numeric", month: "long" })}`}
			</p>
			<p
				class="font-display mt-1 text-5xl font-semibold tracking-tight tabular"
			>
				{money(overview.spentMinor)}
			</p>
			<p class="text-muted-foreground mt-2 text-sm">
				{#if overview.lastMonthSoFarMinor === 0 && overview.spentMinor === 0}
					Nothing spent yet this month.
				{:else if pace <= 0}
					<span class="text-positive font-medium">{money(-pace)} less</span>
					than at this point last month.
				{:else}
					<span class="text-negative font-medium">{money(pace)} more</span>
					than at this point last month.
				{/if}
			</p>
			<dl class="mt-5 grid grid-cols-3 gap-3 text-sm">
				<div>
					<dt class="text-muted-foreground">Came in</dt>
					<dd class="text-positive font-medium tabular">
						+{money(overview.incomeMinor)}
					</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Set aside</dt>
					<dd class="font-medium tabular">{money(overview.asideMinor)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Left over</dt>
					<dd
						class="font-medium tabular {leftOver < 0
							? 'text-negative'
							: 'text-positive'}"
					>
						{overview.incomeMinor === 0 ? "–" : money(leftOver)}
					</dd>
				</div>
			</dl>
		</article>

		<article class="glass flex flex-col gap-2 rounded-3xl p-5 md:p-6">
			<span class="text-muted-foreground flex items-center gap-2 text-sm">
				<CalendarClockIcon class="size-4" />
				By {day(overview.monthEnd, { day: "numeric", month: "long" })}
			</span>
			<p class="font-display text-3xl font-semibold tabular">
				≈ {money(overview.forecastMinor)}
			</p>
			<p class="text-muted-foreground text-sm">
				{#if overview.lastMonthMinor > 0}
					At this pace. Last month: {money(overview.lastMonthMinor)}.
				{:else}
					At this pace, from your last three months.
				{/if}
			</p>
		</article>

		<article class="glass flex flex-col gap-2 rounded-3xl p-5 md:p-6">
			<span class="text-muted-foreground flex items-center gap-2 text-sm">
				<SunriseIcon class="size-4" />
				Yesterday, {day(overview.yesterday.day, {
					weekday: "long",
				})}
			</span>
			{#if overview.yesterday.count === 0}
				<p class="font-medium">Nothing spent. Nice.</p>
			{:else}
				<p class="font-display text-2xl font-semibold tabular">
					{money(overview.yesterday.spentMinor)}
				</p>
				<p class="text-muted-foreground text-sm">
					{overview.yesterday.count}
					{overview.yesterday.count === 1
						? "payment"
						: "payments"}{#if overview.yesterday.biggest}, the biggest {overview
							.yesterday.biggest.description} at {money(
							overview.yesterday.biggest.amountMinor,
						)}{/if}.
				</p>
			{/if}
		</article>

		<article class="glass flex flex-col gap-2 rounded-3xl p-5 md:p-6">
			<span class="text-muted-foreground flex items-center gap-2 text-sm">
				<TrendingUpIcon class="size-4" />
				Your biggest habit
			</span>
			{#if overview.habit}
				<p class="truncate font-semibold">{overview.habit.description}</p>
				<p class="text-muted-foreground text-sm">
					{money(overview.habit.totalMinor)} over {overview.habit.count} times in
					three months, about {money(overview.habit.weeklyMinor)} a week.
				</p>
			{:else}
				<p class="text-muted-foreground text-sm">
					Nothing repeats enough yet to call it a habit.
				</p>
			{/if}
		</article>

		<article class="glass flex flex-col gap-2 rounded-3xl p-5 md:p-6">
			<span class="text-muted-foreground text-sm">Top category this month</span>
			{#if top && overview.topCategory}
				<span class="flex items-center gap-3">
					<span
						class="category-tile flex size-10 shrink-0 items-center justify-center rounded-xl"
						style={categoryStyle(top)}
					>
						<top.icon class="size-5" />
					</span>
					<span class="min-w-0">
						<span class="block truncate font-semibold">{top.label}</span>
						<span class="text-muted-foreground block text-sm tabular"
							>{money(overview.topCategory.totalMinor)}{#if topChange !== null}
								, {topChange >= 0 ? "+" : ""}{topChange}% on last month{/if}</span
						>
					</span>
				</span>
			{:else}
				<p class="text-muted-foreground text-sm">Nothing spent yet.</p>
			{/if}
		</article>
	</div>

	<div class="grid gap-4 lg:grid-cols-3">
		<div class="min-w-0 lg:col-span-2 [&>section]:mt-0">
			<SpendingChart
				overTime={overview.daily}
				bucket="day"
				title="Day by day"
				totalMinor={overview.spentMinor}
				currency={overview.currency}
			/>
		</div>
		<article class="glass flex flex-col gap-3 rounded-3xl p-5 md:p-6">
			<span class="text-muted-foreground flex items-center gap-2 text-sm">
				<RepeatIcon class="size-4" />
				Every month
			</span>
			{#if overview.recurring.length === 0}
				<p class="text-muted-foreground text-sm">
					No repeating payment spotted yet.
				</p>
			{:else}
				<p class="font-display text-2xl font-semibold tabular">
					{money(recurringTotal)}
				</p>
				<ul class="flex flex-col gap-1.5 text-sm">
					{#each overview.recurring as entry (entry.description)}
						<li class="flex justify-between gap-3">
							<span class="truncate">{entry.description}</span>
							<span class="tabular">{money(entry.amountMinor)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</article>
	</div>
</section>
