<script lang="ts">
	import PauseIcon from "@lucide/svelte/icons/pause";
	import PlayIcon from "@lucide/svelte/icons/play";
	import RepeatIcon from "@lucide/svelte/icons/repeat";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";

	import { categoryOf } from "#lib/categories.js";
	import EmptyState from "#lib/components/empty-state.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import { Badge } from "#lib/components/ui/badge/index.js";
	import { formatMoney } from "#lib/money.js";
	import { frequencyLabels } from "#lib/recurrence.js";

	const { data } = $props();

	const names = $derived(
		new Map(data.members.map((member) => [member.id, member.displayName])),
	);
	const merchantNames = $derived(
		new Map(data.merchants.map((merchant) => [merchant.id, merchant.name])),
	);

	function dateLabel(day: string): string {
		return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
			day: "numeric",
			month: "long",
		});
	}
</script>

{#if data.rules.length === 0}
	<div class="glass rounded-2xl">
		<EmptyState
			icon={RepeatIcon}
			title="Nothing repeats yet"
			subtitle="Pick Repeat when adding an expense, like rent or a subscription, and it shows up here."
		/>
	</div>
{:else}
	<ul class="glass divide-border divide-y overflow-hidden rounded-2xl">
		{#each data.rules as rule (rule.id)}
			{@const category = categoryOf(rule.category, data.categories)}
			{@const merchant = rule.merchantId
				? merchantNames.get(rule.merchantId)
				: undefined}
			<li>
				<ItemMenu
					title={rule.description}
					class="min-h-18 px-3 py-2.5 md:px-4"
					actions={[
						{
							label: rule.active ? "Pause" : "Resume",
							icon: rule.active ? PauseIcon : PlayIcon,
							form: {
								action: "?/setRecurringActive",
								fields: { id: rule.id, active: String(!rule.active) },
								loading: rule.active ? "Pausing" : "Resuming",
								success: rule.active
									? `${rule.description} paused.`
									: `${rule.description} resumed.`,
							},
						},
						{
							label: "Delete",
							icon: Trash2Icon,
							destructive: true,
							form: {
								action: "?/deleteRecurring",
								fields: { id: rule.id },
								loading: "Deleting",
								success: "Repeating expense deleted.",
								confirm: {
									title: `Stop repeating "${rule.description}"?`,
									description:
										"No more copies get added. The ones already added stay.",
									confirmLabel: "Delete",
								},
							},
						},
					]}
				>
					<span
						class="bg-accent text-accent-foreground flex size-11 shrink-0 items-center justify-center rounded-xl"
					>
						<category.icon class="size-5" />
					</span>
					<span class="min-w-0 flex-1">
						<span class="flex items-center gap-2">
							<span class="truncate font-medium">{rule.description}</span>
							{#if !rule.active}<Badge variant="secondary">Paused</Badge>{/if}
						</span>
						<span class="text-muted-foreground block truncate text-sm">
							{frequencyLabels[rule.frequency]}{rule.active
								? `, next on ${dateLabel(rule.nextOn)}`
								: ""}. {names.get(rule.paidBy) ?? "Someone"} pays{merchant
								? ` at ${merchant}`
								: ""}.
						</span>
					</span>
					<span class="font-display font-semibold tabular"
						>{formatMoney(rule.amountMinor, data.group.currency)}</span
					>
				</ItemMenu>
			</li>
		{/each}
	</ul>
{/if}
