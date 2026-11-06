<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import LayersIcon from "@lucide/svelte/icons/layers";
	import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
	import UsersIcon from "@lucide/svelte/icons/users";
	import WalletIcon from "@lucide/svelte/icons/wallet";

	import { type AccountView, balanceTotals } from "#lib/account-types.js";
	import { countShared } from "#lib/count-shared.svelte.js";
	import { formatMoney } from "#lib/money.js";

	interface Props {
		accounts: AccountView[];
		currency: string;
		active: string | null;
		href: (accountId: string | null) => string;
	}

	const { accounts, currency, active, href }: Props = $props();

	let mounted = $state(false);

	$effect(() => {
		mounted = true;
	});

	const totals = $derived(
		balanceTotals(accounts, currency, mounted && countShared.on),
	);
	const ordered = $derived([
		...accounts.filter((account) => !account.shared),
		...accounts.filter((account) => account.shared),
	]);
	const syncing = $derived(accounts.some((account) => account.syncing));

	$effect(() => {
		if (!syncing) {
			return;
		}
		const timer = setInterval(() => void invalidateAll(), 3000);
		return () => clearInterval(timer);
	});
</script>

<nav
	aria-label="Accounts"
	class="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0"
>
	<ul class="flex w-max gap-2">
		<li>
			<a
				href={href(null)}
				data-sveltekit-reset="false"
				aria-current={active === null ? "true" : undefined}
				class="glass aria-current:bg-primary aria-current:text-primary-foreground flex min-h-14 items-center gap-2.5 rounded-2xl py-2 pr-4 pl-2 text-left transition-colors"
			>
				<span
					class="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-full"
				>
					<LayersIcon class="size-4" />
				</span>
				<span class="flex flex-col leading-tight">
					<span class="text-xs opacity-80">All accounts</span>
					<span class="font-semibold tabular"
						>{formatMoney(
							totals.toSpendMinor + totals.savedMinor,
							currency,
						)}</span
					>
				</span>
			</a>
		</li>
		{#each ordered as account (account.id)}
			{@const selected = active === account.id}
			<li>
				<a
					href={account.connectionId
						? href(selected ? null : account.id)
						: resolve("/(protected)/personal/accounts")}
					data-sveltekit-reset="false"
					aria-current={selected ? "true" : undefined}
					title={account.failed
						? `${account.name}: the last sync failed`
						: account.syncing
							? `${account.name}: syncing`
							: account.name}
					class="glass aria-current:bg-primary aria-current:text-primary-foreground flex min-h-14 items-center gap-2.5 rounded-2xl py-2 pr-4 pl-2 text-left transition-colors"
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
						{:else if account.shared}
							<UsersIcon class="size-4" />
						{:else if account.connectionId}
							<LandmarkIcon class="size-4" />
						{:else}
							<WalletIcon class="size-4" />
						{/if}
					</span>
					<span class="flex max-w-40 flex-col leading-tight">
						<span class="flex items-center gap-1 truncate text-xs opacity-80">
							{account.name}
							{#if account.syncing}
								<LoaderCircleIcon
									class="size-3 shrink-0 animate-spin"
									aria-hidden="true"
								/>
							{:else if account.failed}
								<span
									class="bg-destructive size-1.5 shrink-0 rounded-full"
									aria-hidden="true"
								></span>
							{/if}
						</span>
						<span class="font-semibold tabular"
							>{account.balance
								? formatMoney(account.balance.minor, account.balance.currency)
								: "-"}</span
						>
					</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>
