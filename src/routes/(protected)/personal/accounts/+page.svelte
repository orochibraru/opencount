<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import LineChartIcon from "@lucide/svelte/icons/chart-line";
	import CheckIcon from "@lucide/svelte/icons/check";
	import CreditCardIcon from "@lucide/svelte/icons/credit-card";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PiggyBankIcon from "@lucide/svelte/icons/piggy-bank";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import TagIcon from "@lucide/svelte/icons/tag";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
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
	import Fab from "#lib/components/fab.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import Picker from "#lib/components/picker.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { currencies } from "#lib/currencies.js";
	import { currencyDigits, formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	let adding = $state(false);
	let newName = $state("");
	let newType = $state<string>("checking");
	let newCurrency = $state("EUR");
	let newAmount = $state("");
	let newAsOf = $state("");
	let addErrors = $state<Record<string, string[]>>({});

	const typeOptions = accountTypes.map((type) => ({
		value: type,
		label: accountTypeLabels[type],
	}));
	const currencyOptions = currencies.map((code) => ({
		value: code,
		label: code,
	}));

	function startAdding() {
		newName = "";
		newType = "checking";
		newCurrency = data.accounts[0]?.currency ?? "EUR";
		newAmount = "";
		newAsOf = new Date().toISOString().slice(0, 10);
		addErrors = {};
		adding = true;
	}

	setPageTitle("Accounts", resolve("/(protected)/personal"), [
		{
			label: "Add an account",
			icon: PlusIcon,
			onSelect: startAdding,
			primary: true,
		},
	]);

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
			account.bankName ?? "Added by hand",
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
			subtitle="Link a bank to see its accounts here, or add one by hand, like cash or a broker, and keep its balance yourself."
		>
			<div class="flex flex-wrap justify-center gap-2">
				<Button size="lg" class="h-11 rounded-xl px-6" onclick={startAdding}>
					<PlusIcon />
					Add an account
				</Button>
				<Button
					href={resolve("/(protected)/account/banks/linked")}
					size="lg"
					variant="secondary"
					class="h-11 rounded-xl px-6"
				>
					<LandmarkIcon />
					Link a bank
				</Button>
			</div>
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
							...(account.connectionId === null
								? [
										{
											label: "Delete",
											icon: Trash2Icon,
											destructive: true,
											form: {
												action: "?/remove",
												fields: { id: account.id },
												loading: "Deleting the account",
												success: "Account deleted.",
												confirm: {
													title: `Delete ${account.name}?`,
													description:
														"Its balance stops counting anywhere. Your expenses stay.",
													confirmLabel: "Delete",
												},
											},
										},
									]
								: []),
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

<Fab label="Add an account" icon={PlusIcon} onclick={startAdding} />

<ResponsiveSheet
	bind:open={adding}
	title="Add an account"
	description="For money no linked bank reports, like cash or a broker. You keep its balance up to date."
>
	<form
		method="POST"
		action="?/add"
		class="flex flex-col gap-4 pb-4"
		use:enhance={enhanceToast({
			loading: "Adding the account",
			success: "Account added.",
			onFailure: (result) =>
				(addErrors = (result?.errors as Record<string, string[]>) ?? {}),
			onSuccess: () => {
				adding = false;
			},
		})}
	>
		<Field.Field>
			<Field.Label for="new-name">Name</Field.Label>
			<Input
				id="new-name"
				name="name"
				required
				maxlength={60}
				placeholder="Cash"
				class="h-11"
				bind:value={newName}
			/>
			<Field.Error errors={addErrors.name?.map((message) => ({ message }))} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="new-type">Type</Field.Label>
			<Picker
				id="new-type"
				name="type"
				label="Type"
				options={typeOptions}
				bind:value={newType}
			/>
		</Field.Field>
		<Field.Field>
			<Field.Label for="new-currency">Currency</Field.Label>
			<Picker
				id="new-currency"
				name="currency"
				label="Currency"
				options={currencyOptions}
				bind:value={newCurrency}
			/>
		</Field.Field>
		<Field.Field>
			<Field.Label for="new-amount">Balance</Field.Label>
			<Input
				id="new-amount"
				name="amount"
				inputmode="decimal"
				required
				placeholder="250.00"
				class="h-11"
				bind:value={newAmount}
			/>
			<Field.Error errors={addErrors.amount?.map((message) => ({ message }))} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="new-day">On</Field.Label>
			<DateField id="new-day" name="asOf" label="Day" bind:value={newAsOf} />
		</Field.Field>
		<Button type="submit" class="h-11 rounded-xl">
			<CheckIcon />
			Add the account
		</Button>
	</form>
</ResponsiveSheet>

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
