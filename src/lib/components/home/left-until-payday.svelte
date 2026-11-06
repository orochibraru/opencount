<script lang="ts">
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import CreditCardIcon from "@lucide/svelte/icons/credit-card";
	import RepeatIcon from "@lucide/svelte/icons/repeat";

	import { accountTypeLabels } from "#lib/account-types.js";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Switch } from "#lib/components/ui/switch/index.js";
	import {
		type LeftParts,
		leftUntilPayday,
		spendable,
	} from "#lib/left-until-payday.js";
	import { formatFlow, formatMoney } from "#lib/money.js";

	interface Props {
		parts: LeftParts;
		included: string[];
	}

	const { parts, included }: Props = $props();

	const storageKey = "left-until-payday-accounts";

	let open = $state(false);
	let chosen = $state<string[] | null>(null);

	$effect(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			const ids: unknown = saved ? JSON.parse(saved) : null;
			if (Array.isArray(ids)) {
				chosen = ids.filter(
					(id): id is string =>
						typeof id === "string" &&
						parts.accounts.some((account) => account.id === id),
				);
			}
		} catch {
			chosen = null;
		}
	});

	const counted = $derived(new Set(chosen ?? included));
	const result = $derived(leftUntilPayday(parts, counted));
	const money = (minor: number) => formatMoney(minor, parts.currency);
	const listed = $derived(
		parts.accounts.filter((account) => spendable(account.type)),
	);
	const custom = $derived(chosen !== null);

	function day(value: string): string {
		return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
			undefined,
			{ day: "numeric", month: "short" },
		);
	}

	function toggle(id: string, on: boolean) {
		const next = new Set(counted);
		if (on) {
			next.add(id);
		} else {
			next.delete(id);
		}
		chosen = [...next];
		try {
			localStorage.setItem(storageKey, JSON.stringify(chosen));
		} catch {
			return;
		}
	}

	function reset() {
		chosen = null;
		try {
			localStorage.removeItem(storageKey);
		} catch {
			return;
		}
	}

	function counts(accountId: string | null): boolean {
		return (
			accountId === null ||
			counted.has(accountId) ||
			!parts.accounts.some((account) => account.id === accountId)
		);
	}
</script>

<button
	type="button"
	class="glass flex w-full min-w-0 items-center gap-3 rounded-2xl p-4 text-left md:p-6"
	onclick={() => (open = true)}
	aria-label="Left until payday: {money(result.leftMinor)}, see how"
>
	<span class="min-w-0 flex-1">
		<span class="text-muted-foreground block text-sm">Left until payday</span>
		<span
			class="font-display mt-1 block text-4xl font-semibold tabular {result.leftMinor <
			0
				? 'text-negative'
				: ''}">{money(result.leftMinor)}</span
		>
		<span class="text-muted-foreground mt-1 block text-sm">
			<span class="text-foreground font-medium tabular"
				>{money(result.perDayMinor)} a day</span
			>
			for {parts.daysLeft}
			{parts.daysLeft === 1 ? "day" : "days"}, payday {day(parts.nextPayday)}
		</span>
	</span>
	<ChevronRightIcon class="text-muted-foreground size-5 shrink-0" />
</button>

<ResponsiveSheet
	bind:open
	title="Left until payday"
	description="Your accounts, minus what still has to go out before {day(
		parts.nextPayday,
	)}."
>
	<div class="flex flex-col gap-4 pb-4">
		<section aria-label="Accounts">
			<h3 class="text-muted-foreground mb-1 text-sm font-medium">
				Accounts counted
			</h3>
			<ul class="divide-border divide-y">
				{#each listed as account (account.id)}
					<li class="flex min-h-14 items-center gap-3">
						<label for="count-{account.id}" class="min-w-0 flex-1">
							<span class="block truncate font-medium">{account.name}</span>
							<span class="text-muted-foreground block truncate text-sm">
								{accountTypeLabels[account.type]}{account.shared
									? ", counts half"
									: ""}{account.balanceAt ? ` · ${day(account.balanceAt)}` : ""}
							</span>
						</label>
						<span class="tabular shrink-0 text-sm"
							>{money(account.ownShareMinor)}</span
						>
						<Switch
							id="count-{account.id}"
							checked={counted.has(account.id)}
							onCheckedChange={(on) => toggle(account.id, on)}
						/>
					</li>
				{/each}
			</ul>
			{#if custom}
				<button
					type="button"
					class="text-primary mt-1 min-h-11 text-sm font-medium"
					onclick={reset}>Back to everyday accounts only</button
				>
			{/if}
		</section>

		<dl class="flex flex-col gap-2 text-sm">
			<div class="flex justify-between gap-4">
				<dt>In those accounts</dt>
				<dd class="tabular">{money(result.balancesMinor)}</dd>
			</div>
			{#each parts.upcoming as entry, index (`${entry.label}-${entry.on}-${index}`)}
				{#if counts(entry.accountId)}
					<div class="text-muted-foreground flex justify-between gap-4">
						<dt class="flex min-w-0 items-center gap-1.5">
							<RepeatIcon class="size-3.5 shrink-0" />
							<span class="truncate">{entry.label}, {day(entry.on)}</span>
						</dt>
						<dd class="tabular">
							{formatFlow(entry.minor, parts.currency, false)}
						</dd>
					</div>
				{/if}
			{/each}
			{#if result.pendingMinor > 0}
				<div class="text-muted-foreground flex justify-between gap-4">
					<dt class="flex min-w-0 items-center gap-1.5">
						<CreditCardIcon class="size-3.5 shrink-0" />
						<span class="truncate">Card purchases not yet debited</span>
					</dt>
					<dd class="tabular">
						{formatFlow(result.pendingMinor, parts.currency, false)}
					</dd>
				</div>
			{/if}
			<div
				class="border-border flex justify-between gap-4 border-t pt-2 font-semibold"
			>
				<dt>Left</dt>
				<dd class="tabular">{money(result.leftMinor)}</dd>
			</div>
			<div class="flex justify-between gap-4">
				<dt>
					Per day, {parts.daysLeft}
					{parts.daysLeft === 1 ? "day" : "days"}
				</dt>
				<dd class="tabular">{money(result.perDayMinor)}</dd>
			</div>
		</dl>
		<p class="text-muted-foreground text-xs">
			Balances are from each account's last sync. Savings and investments never
			count.
		</p>
	</div>
</ResponsiveSheet>
