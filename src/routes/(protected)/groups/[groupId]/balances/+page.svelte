<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
	import CheckCheckIcon from "@lucide/svelte/icons/check-check";
	import PartyPopperIcon from "@lucide/svelte/icons/party-popper";

	import EmptyState from "#lib/components/empty-state.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { haptic } from "#lib/haptics.js";
	import { formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	setPageTitle("Balances", () =>
		resolve("/(protected)/groups/[groupId]", { groupId: data.group.id }),
	);

	const names = $derived(
		new Map(data.members.map((member) => [member.id, member.displayName])),
	);
	const largest = $derived(
		Math.max(
			1,
			...Object.values(data.balances).map((value) => Math.abs(value)),
		),
	);
</script>

<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
	<section
		aria-labelledby="balances-heading"
		class="glass rounded-2xl p-4 md:p-6"
	>
		<h2 id="balances-heading" class="mb-4 text-lg font-semibold">Balances</h2>
		<ul class="flex flex-col gap-3">
			{#each data.members as member (member.id)}
				{@const balance = data.balances[member.id] ?? 0}
				<li class="grid grid-cols-[minmax(6rem,9rem)_1fr] items-center gap-3">
					<span class="truncate text-sm font-medium">
						{member.displayName}{member.id === data.myMemberId ? " (you)" : ""}
					</span>
					<div class="relative flex h-9 items-center">
						<span
							class="bg-border absolute top-1 bottom-1 left-1/2 w-px"
							aria-hidden="true"
						></span>
						<span
							class="absolute top-1.5 bottom-1.5 rounded-full {balance >= 0
								? 'bg-positive/20 left-1/2'
								: 'bg-negative/20 right-1/2'}"
							style="width: {(Math.abs(balance) / largest) * 50}%"
							aria-hidden="true"
						></span>
						<span
							class="relative w-1/2 px-2 text-sm font-semibold tabular {balance >=
							0
								? 'ml-auto text-left'
								: 'text-right'} {balance > 0
								? 'text-positive'
								: balance < 0
									? 'text-negative'
									: 'text-muted-foreground'}"
						>
							{formatMoney(balance, data.group.currency, { signed: true })}
						</span>
					</div>
				</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="settle-heading">
		<h2 id="settle-heading" class="mb-3 px-1 text-lg font-semibold">
			Settle up
		</h2>
		{#if data.transfers.length === 0}
			<div class="glass rounded-2xl">
				<EmptyState
					icon={PartyPopperIcon}
					title="Everyone's square"
					subtitle="Nobody owes anything right now."
				/>
			</div>
		{:else}
			<ul class="flex flex-col gap-3">
				{#each data.transfers as transfer (`${transfer.from}-${transfer.to}`)}
					<li
						class="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center"
					>
						<div class="flex min-w-0 flex-1 items-center gap-2 font-medium">
							<span class="truncate">{names.get(transfer.from)}</span>
							<ArrowRightIcon class="text-muted-foreground size-4 shrink-0" />
							<span class="truncate">{names.get(transfer.to)}</span>
						</div>
						<span class="font-display text-xl font-semibold tabular"
							>{formatMoney(transfer.amountMinor, data.group.currency)}</span
						>
						<form
							method="POST"
							action="?/settle"
							use:enhance={enhanceToast({
								loading: "Recording payment",
								success: "Payment recorded.",
								onSuccess: () => haptic("success"),
							})}
						>
							<input type="hidden" name="from" value={transfer.from} />
							<input type="hidden" name="to" value={transfer.to} />
							<input
								type="hidden"
								name="amountMinor"
								value={transfer.amountMinor}
							/>
							<Button
								type="submit"
								variant="secondary"
								class="h-10 w-full rounded-xl sm:w-auto"
							>
								<CheckCheckIcon />
								Mark as paid
							</Button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
