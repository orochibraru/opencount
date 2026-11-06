<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
	import WalletIcon from "@lucide/svelte/icons/wallet";

	import {
		accountTypeLabels,
		type AccountView,
		balanceTotals,
		holdsSavings,
	} from "#lib/account-types.js";
	import { Switch } from "#lib/components/ui/switch/index.js";
	import { countShared } from "#lib/count-shared.svelte.js";
	import { formatMoney } from "#lib/money.js";

	interface Props {
		accounts: AccountView[];
		currency: string;
	}

	const { accounts, currency }: Props = $props();

	let mounted = $state(false);

	$effect(() => {
		mounted = true;
	});

	const withShared = $derived(mounted && countShared.on);
	const totals = $derived(balanceTotals(accounts, currency, withShared));
	const sections = $derived(
		[
			{
				title: "Everyday",
				rows: accounts.filter(
					(account) => !account.shared && !holdsSavings(account.type),
				),
			},
			{
				title: "Savings and investments",
				rows: accounts.filter(
					(account) => !account.shared && holdsSavings(account.type),
				),
			},
			{
				title: "Shared with someone",
				rows: accounts.filter((account) => account.shared),
			},
		].filter((section) => section.rows.length > 0),
	);
	const elsewhere = $derived(
		accounts.filter((account) => account.balance?.currency !== currency).length,
	);
	const syncing = $derived(accounts.some((account) => account.syncing));
	const failed = $derived(accounts.some((account) => account.failed));
	const syncedAt = $derived(
		accounts
			.map((account) => account.syncedAt)
			.filter((value) => value !== null)
			.toSorted()
			.at(-1),
	);

	$effect(() => {
		if (!syncing) {
			return;
		}
		const timer = setInterval(() => void invalidateAll(), 3000);
		return () => clearInterval(timer);
	});

	const money = (minor: number, code = currency) => formatMoney(minor, code);

	function synced(value: string | undefined): string {
		if (syncing) {
			return "Syncing your banks";
		}
		if (!value) {
			return "Typed in by hand";
		}
		const minutes = Math.round(
			(Date.now() - new Date(value).getTime()) / 60_000,
		);
		const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
		if (minutes < 60) {
			return `Synced ${format.format(-minutes, "minute")}`;
		}
		if (minutes < 48 * 60) {
			return `Synced ${format.format(-Math.round(minutes / 60), "hour")}`;
		}
		return `Synced ${format.format(-Math.round(minutes / 1_440), "day")}`;
	}

	function detail(account: AccountView): string {
		return [
			account.bankName ?? "Added by hand",
			account.shared
				? `${accountTypeLabels[account.type]}, half yours`
				: accountTypeLabels[account.type],
		].join(" · ");
	}

	function href(account: AccountView): string {
		return account.connectionId
			? `${resolve("/(protected)/personal")}?account=${encodeURIComponent(account.id)}`
			: resolve("/(protected)/personal/accounts");
	}
</script>

<section class="glass rounded-3xl p-5 md:p-6" aria-label="Your accounts">
	<p class="text-muted-foreground text-sm">On your accounts</p>
	<p class="font-display mt-1 text-5xl font-semibold tracking-tight tabular">
		{money(totals.toSpendMinor + totals.savedMinor)}
	</p>
	<p class="text-muted-foreground mt-2 text-sm">
		<span class="text-foreground font-medium tabular"
			>{money(totals.toSpendMinor)}</span
		>
		to spend
		{#if totals.savedMinor !== 0}
			·
			<span class="text-foreground font-medium tabular"
				>{money(totals.savedMinor)}</span
			>
			saved
		{/if}
	</p>
	{#if totals.sharedCount > 0}
		<label
			class="bg-muted/60 mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm"
		>
			<span class="min-w-0">
				<span class="block font-medium">Count shared accounts</span>
				<span class="text-muted-foreground block">
					Your half: {money(totals.sharedMinor)}{withShared
						? ", in the total"
						: ", left out"}
				</span>
			</span>
			<Switch
				checked={withShared}
				onCheckedChange={(on) => (countShared.on = on)}
				aria-label="Count shared accounts"
			/>
		</label>
	{/if}

	{#each sections as section (section.title)}
		<h3 class="text-muted-foreground mt-5 mb-1 text-xs font-medium uppercase">
			{section.title}
		</h3>
		<ul class="divide-border -mx-2 divide-y">
			{#each section.rows as account (account.id)}
				<li>
					<a
						href={href(account)}
						class="hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl px-2 py-1.5"
					>
						<span
							class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full {account.bankLogo
								? 'bg-white'
								: 'bg-accent text-accent-foreground'}"
						>
							{#if account.bankLogo}
								<img
									src={account.bankLogo}
									alt=""
									class="size-7 object-contain"
									loading="lazy"
								/>
							{:else if account.connectionId}
								<LandmarkIcon class="size-4" />
							{:else}
								<WalletIcon class="size-4" />
							{/if}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{account.name}</span>
							<span class="text-muted-foreground block truncate text-sm"
								>{detail(account)}</span
							>
						</span>
						<span
							class="tabular shrink-0 font-semibold {account.balance &&
							account.balance.minor < 0
								? 'text-negative'
								: ''}"
						>
							{account.balance
								? money(account.balance.minor, account.balance.currency)
								: "-"}
						</span>
						<ChevronRightIcon class="text-muted-foreground size-4 shrink-0" />
					</a>
				</li>
			{/each}
		</ul>
	{/each}

	<div
		class="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"
	>
		<span class="flex items-center gap-1.5">
			{#if syncing}<LoaderCircleIcon
					class="size-4 animate-spin"
					aria-hidden="true"
				/>{:else if failed}<span
					class="bg-destructive size-2 rounded-full"
					aria-hidden="true"
				></span>{/if}
			{failed && !syncing ? "A bank's last sync failed" : synced(syncedAt)}
		</span>
		<a
			href={resolve("/(protected)/personal/accounts")}
			class="text-primary flex min-h-11 items-center font-medium"
			>Manage accounts</a
		>
	</div>
	{#if elsewhere > 0}
		<p class="text-muted-foreground text-xs">
			{elsewhere}
			{elsewhere === 1 ? "account is" : "accounts are"} in another currency, left
			out of the total.
		</p>
	{/if}
</section>
