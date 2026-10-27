<script lang="ts">
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import BanknoteIcon from "@lucide/svelte/icons/banknote";
	import HistoryIcon from "@lucide/svelte/icons/history";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
	import UnlinkIcon from "@lucide/svelte/icons/unlink";

	import ItemMenu from "#lib/components/item-menu.svelte";
	import Picker, { type PickerOption } from "#lib/components/picker.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { getBanks } from "#lib/remote/banks.remote.js";
	import { enhanceToast, toastError } from "#lib/toast.js";

	interface Connection {
		id: string;
		bankName: string;
		bankLogo: string | null;
		accounts: { uid: string; name: string; currency: string }[];
		validUntil: Date;
		syncedAt: Date | null;
		lastError: string | null;
		lastAdded: number | null;
		syncing: boolean;
		historyFrom: string | null;
	}

	const { connections }: { connections: Connection[] } = $props();

	const anySyncing = $derived(
		connections.some((connection) => connection.syncing),
	);

	$effect(() => {
		if (!anySyncing) {
			return;
		}
		const timer = setInterval(() => void invalidateAll(), 3000);
		return () => clearInterval(timer);
	});

	const countryCodes = [
		"AT",
		"BE",
		"BG",
		"HR",
		"CY",
		"CZ",
		"DK",
		"EE",
		"FI",
		"FR",
		"DE",
		"GR",
		"HU",
		"IS",
		"IE",
		"IT",
		"LV",
		"LI",
		"LT",
		"LU",
		"MT",
		"NL",
		"NO",
		"PL",
		"PT",
		"RO",
		"SK",
		"SI",
		"ES",
		"SE",
		"GB",
	];
	const countryNames = new Intl.DisplayNames(undefined, { type: "region" });
	const countries = countryCodes
		.map((code) => ({
			value: code,
			label: countryNames.of(code) ?? code,
			emoji: String.fromCodePoint(
				...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)),
			),
		}))
		.toSorted((left, right) => left.label.localeCompare(right.label));

	let connectOpen = $state(false);
	let country = $state("");
	let bank = $state("");
	let banks = $state<Promise<PickerOption[]>>();

	function pickCountry(code: string) {
		bank = "";
		banks = getBanks(code).then((list) =>
			list.map((entry) => ({
				value: entry.name,
				label: entry.name,
				image: entry.logo ?? undefined,
			})),
		);
	}

	function day(value: Date | string): string {
		return new Date(
			typeof value === "string" ? `${value}T12:00:00` : value,
		).toLocaleDateString(undefined, {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}

	function status(connection: Connection): string {
		if (connection.syncing) {
			return connection.syncedAt
				? "Syncing…"
				: "Fetching all the history your bank keeps…";
		}
		if (connection.lastError) {
			return connection.lastError;
		}
		if (!connection.syncedAt) {
			return "Waiting for the first sync";
		}
		return [
			`Synced ${connection.syncedAt.toLocaleString(undefined, {
				dateStyle: "short",
				timeStyle: "short",
			})}`,
			connection.lastAdded !== null ? `${connection.lastAdded} new` : null,
			connection.historyFrom
				? `history since ${day(connection.historyFrom)}`
				: null,
			`linked until ${day(connection.validUntil)}`,
		]
			.filter(Boolean)
			.join(" · ");
	}
</script>

<section class="glass flex min-w-0 flex-col gap-4 rounded-2xl p-4 md:p-6">
	<div class="flex items-start gap-3">
		<span
			class="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl"
		>
			<LandmarkIcon class="size-5" />
		</span>
		<div>
			<h2 class="font-semibold">Linked banks</h2>
			<p class="text-muted-foreground mt-1 text-sm">
				Each syncs every day into Personal. The first sync fetches all the
				history your bank keeps; your bank asks you to confirm again every 90
				days.
			</p>
		</div>
	</div>
	{#if connections.length > 0}
		<ul class="divide-border -mx-1 divide-y" aria-label="Linked banks">
			{#each connections as connection (connection.id)}
				<li>
					<ItemMenu
						title={connection.bankName}
						class="min-h-14 px-1 py-2"
						actions={[
							{
								label: "Sync now",
								icon: RefreshCwIcon,
								form: {
									action: "?/syncBank",
									fields: { id: connection.id },
									loading: "Asking the bank",
									success: "Syncing. New expenses show up in a moment.",
								},
							},
							{
								label: "Fetch full history",
								icon: HistoryIcon,
								form: {
									action: "?/syncBank",
									fields: { id: connection.id, full: "true" },
									loading: "Asking the bank",
									success:
										"Fetching all the history your bank keeps. Lines already here stay as they are.",
								},
							},
							{
								label: "Unlink",
								icon: UnlinkIcon,
								destructive: true,
								form: {
									action: "?/disconnectBank",
									fields: { id: connection.id },
									loading: "Unlinking",
									success: "Bank unlinked.",
									confirm: {
										title: `Unlink ${connection.bankName}?`,
										description:
											"It stops syncing. The expenses it brought stay.",
										confirmLabel: "Unlink",
									},
								},
							},
						]}
					>
						<span
							class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl {connection.bankLogo
								? 'bg-white'
								: 'bg-accent text-accent-foreground'}"
						>
							{#if connection.bankLogo}
								<img
									src={connection.bankLogo}
									alt=""
									class="size-8 object-contain"
									loading="lazy"
								/>
							{:else}
								<LandmarkIcon class="size-5" />
							{/if}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium"
								>{connection.bankName}</span
							>
							<span
								class="flex items-start gap-1.5 text-sm {connection.lastError &&
								!connection.syncing
									? 'text-destructive'
									: 'text-muted-foreground'}"
							>
								{#if connection.syncing}
									<LoaderCircleIcon
										class="mt-0.5 size-3.5 shrink-0 animate-spin"
									/>
								{/if}
								<span class="min-w-0">{status(connection)}</span>
							</span>
						</span>
					</ItemMenu>
				</li>
			{/each}
		</ul>
	{/if}
	<Button
		variant="secondary"
		class="h-11 rounded-xl"
		onclick={() => (connectOpen = true)}
	>
		<BanknoteIcon />
		Link a bank
	</Button>
</section>

<ResponsiveSheet
	bind:open={connectOpen}
	title="Link a bank"
	description="You confirm on your bank's own screen, then come back here. OpenCount only reads your transactions."
>
	<form
		method="POST"
		action="?/connectBank"
		class="flex flex-col gap-4 pb-4"
		use:enhance={enhanceToast({
			loading: "Opening your bank",
			success: "Confirm on your bank's screen.",
		})}
	>
		<Field.Field>
			<Field.Label for="bank-country">Country</Field.Label>
			<Picker
				id="bank-country"
				name="country"
				label="Country"
				options={countries}
				bind:value={country}
				placeholder="Pick a country"
				search={{
					placeholder: "Search countries",
					empty: "No country with that name.",
				}}
				onPick={pickCountry}
			/>
		</Field.Field>
		{#if banks}
			{#await banks}
				<p class="text-muted-foreground text-sm">Loading the banks…</p>
			{:then options}
				<Field.Field>
					<Field.Label for="bank-name">Bank</Field.Label>
					<Picker
						id="bank-name"
						name="name"
						label="Bank"
						{options}
						bind:value={bank}
						placeholder="Pick your bank"
						search={{
							placeholder: "Search banks",
							empty: "No bank with that name.",
						}}
					/>
				</Field.Field>
			{:catch error}
				<p class="text-destructive text-sm">
					{toastError(error, "Couldn't load the banks. Try again.")}
				</p>
			{/await}
		{/if}
		<Button type="submit" class="h-11 rounded-xl" disabled={!bank}>
			<LandmarkIcon />
			Continue to the bank
		</Button>
	</form>
</ResponsiveSheet>
