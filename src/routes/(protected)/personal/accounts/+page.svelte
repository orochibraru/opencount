<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import LineChartIcon from "@lucide/svelte/icons/chart-line";
	import CheckIcon from "@lucide/svelte/icons/check";
	import CreditCardIcon from "@lucide/svelte/icons/credit-card";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PiggyBankIcon from "@lucide/svelte/icons/piggy-bank";
	import TagIcon from "@lucide/svelte/icons/tag";
	import UsersIcon from "@lucide/svelte/icons/users";
	import WalletIcon from "@lucide/svelte/icons/wallet";
	import type { Component } from "svelte";

	import {
		type AccountType,
		accountTypeLabels,
		accountTypes,
	} from "#lib/account-types.js";
	import DateField from "#lib/components/date-field.svelte";
	import EmptyState from "#lib/components/empty-state.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { currencyDigits, formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	setPageTitle("Accounts", resolve("/(protected)/personal"));

	type Account = (typeof data.accounts)[number];

	const typeIcons: Record<AccountType, Component> = {
		checking: WalletIcon,
		joint: UsersIcon,
		savings: PiggyBankIcon,
		investment: LineChartIcon,
		credit_card: CreditCardIcon,
	};

	let typing = $state<Account>();
	let typeOpen = $state(false);
	let balancing = $state<Account>();
	let balanceOpen = $state(false);
	let amount = $state("");
	let asOf = $state("");
	let errors = $state<Record<string, string[]>>({});

	function day(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			day: "numeric",
			month: "short",
		});
	}

	function detail(account: Account): string {
		return [
			account.bankName,
			accountTypeLabels[account.type],
			account.shared ? "Shared, counts half" : null,
		]
			.filter(Boolean)
			.join(" · ");
	}

	function balanceNote(account: Account): string {
		if (!account.balance) {
			return "No balance yet";
		}
		return account.balance.manual
			? `Typed in for ${day(account.balance.at)}`
			: `Synced ${day(account.balance.at)}`;
	}

	function openBalance(account: Account) {
		balancing = account;
		amount = account.balance
			? (
					account.balance.minor /
					10 ** currencyDigits(account.balance.currency)
				).toFixed(currencyDigits(account.balance.currency))
			: "";
		asOf = new Date().toISOString().slice(0, 10);
		errors = {};
		balanceOpen = true;
	}
</script>

<div class="flex flex-col gap-4 px-4 md:max-w-2xl md:px-6">
	<p class="text-muted-foreground text-sm">
		Each account's balance comes from your bank's last sync, or the one you
		typed in when it's newer. A joint account counts at half; savings and
		investments hold money set aside.
	</p>
	{#if data.accounts.length === 0}
		<EmptyState
			icon={LandmarkIcon}
			title="No account yet"
			subtitle="Link a bank to see its accounts and balances here."
		>
			<Button
				href={resolve("/(protected)/account/banks/linked")}
				size="lg"
				class="h-11 rounded-xl px-6"
			>
				<LandmarkIcon />
				Link a bank
			</Button>
		</EmptyState>
	{:else}
		<ul
			class="glass divide-border divide-y overflow-hidden rounded-2xl"
			aria-label="Accounts"
		>
			{#each data.accounts as account (account.id)}
				{@const Icon = typeIcons[account.type]}
				<li>
					<ItemMenu
						title={account.name}
						class="min-h-16 px-3 py-2 md:px-4"
						actions={[
							{
								label: "Set the balance",
								icon: PencilIcon,
								onSelect: () => openBalance(account),
							},
							{
								label: "Change the type",
								icon: TagIcon,
								onSelect: () => {
									typing = account;
									typeOpen = true;
								},
							},
							{
								label: account.shared
									? "Not shared"
									: "Shared with someone: counts half",
								icon: UsersIcon,
								form: {
									action: "?/setShared",
									fields: {
										id: account.id,
										shared: String(!account.shared),
									},
									loading: "Saving",
									success: "Saved.",
								},
							},
						]}
					>
						<span
							class="category-tile flex size-11 shrink-0 items-center justify-center rounded-xl"
							style="--category-chroma: 0"
						>
							<Icon class="size-5" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{account.name}</span>
							<span class="text-muted-foreground block truncate text-sm">
								{detail(account)}
							</span>
						</span>
						<span class="flex shrink-0 flex-col items-end">
							<span class="font-display font-semibold tabular">
								{account.balance
									? formatMoney(account.balance.minor, account.balance.currency)
									: "-"}
							</span>
							<span class="text-muted-foreground text-xs">
								{balanceNote(account)}
							</span>
						</span>
					</ItemMenu>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if typing}
	<ResponsiveSheet
		bind:open={typeOpen}
		title="Account type"
		description={typing.name}
	>
		<form
			method="POST"
			action="?/setType"
			class="pb-4"
			use:enhance={enhanceToast({
				loading: "Saving",
				success: "Saved.",
				onSuccess: () => {
					typeOpen = false;
				},
			})}
		>
			<input type="hidden" name="id" value={typing.id} />
			<ul class="flex flex-col gap-1">
				{#each accountTypes as type (type)}
					{@const Icon = typeIcons[type]}
					{@const current = typing.type === type}
					<li>
						<button
							type="submit"
							name="type"
							value={type}
							disabled={current}
							class="hover:bg-muted flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left disabled:opacity-100 {current
								? 'bg-muted font-medium'
								: ''}"
						>
							<span
								class="category-tile flex size-9 items-center justify-center rounded-lg"
								style="--category-chroma: 0"
							>
								<Icon class="size-4" />
							</span>
							<span class="min-w-0 flex-1 truncate"
								>{accountTypeLabels[type]}</span
							>
							{#if current}<CheckIcon
									class="text-muted-foreground size-4"
								/>{/if}
						</button>
					</li>
				{/each}
			</ul>
		</form>
	</ResponsiveSheet>
{/if}

{#if balancing}
	<ResponsiveSheet
		bind:open={balanceOpen}
		title="Set the balance"
		description="What {balancing.name} held on a day, when your bank doesn't say. A newer sync takes over."
	>
		<form
			method="POST"
			action="?/setBalance"
			class="flex flex-col gap-4 pb-4"
			use:enhance={enhanceToast({
				loading: "Saving the balance",
				success: "Balance saved.",
				onFailure: (result) =>
					(errors = (result?.errors as Record<string, string[]>) ?? {}),
				onSuccess: () => {
					balanceOpen = false;
				},
			})}
		>
			<input type="hidden" name="id" value={balancing.id} />
			<Field.Field>
				<Field.Label for="balance-amount"
					>Balance in {balancing.currency}</Field.Label
				>
				<Input
					id="balance-amount"
					name="amount"
					inputmode="decimal"
					required
					placeholder="1250.40"
					class="h-11"
					bind:value={amount}
				/>
				<Field.Error errors={errors.amount?.map((message) => ({ message }))} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="balance-day">On</Field.Label>
				<DateField id="balance-day" name="asOf" label="Day" bind:value={asOf} />
				<Field.Error errors={errors.asOf?.map((message) => ({ message }))} />
			</Field.Field>
			<Button type="submit" class="h-11 rounded-xl">
				<CheckIcon />
				Save
			</Button>
		</form>
	</ResponsiveSheet>
{/if}
