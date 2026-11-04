<script lang="ts">
	import { resolve } from "$app/paths";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import WandIcon from "@lucide/svelte/icons/wand-sparkles";

	import { categoryOf } from "#lib/categories.js";
	import EmptyState from "#lib/components/empty-state.svelte";
	import Fab from "#lib/components/fab.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import RuleSheet, {
		type RuleDraft,
	} from "#lib/components/personal/rule-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";

	const { data } = $props();

	const blank: RuleDraft = {
		id: "",
		pattern: "",
		category: null,
		tag: null,
		pay: false,
		recurringId: null,
	};

	let draft = $state<RuleDraft>(blank);
	let open = $state(false);

	function start(rule: RuleDraft) {
		draft = rule;
		open = true;
	}

	setPageTitle("Rules", resolve("/(protected)/personal"), [
		{
			label: "New rule",
			icon: PlusIcon,
			onSelect: () => start(blank),
			primary: true,
		},
	]);

	const seriesNames = $derived(
		new Map(data.series.map((entry) => [entry.id, entry.label])),
	);

	function effects(rule: RuleDraft): string {
		return [
			rule.category ? categoryOf(rule.category, data.categories).label : null,
			rule.tag ? `#${rule.tag}` : null,
			rule.recurringId ? seriesNames.get(rule.recurringId) : null,
			rule.pay ? "Pay" : null,
		]
			.filter(Boolean)
			.join(" · ");
	}
</script>

<div class="flex flex-col gap-4 px-4 md:max-w-2xl md:px-6">
	{#if data.rules.length === 0}
		<EmptyState
			icon={WandIcon}
			title="No rule yet"
			subtitle="Say once that a line with STATION in it is Transport, or that money from your employer is your pay: every line like it, now and later, follows."
		>
			<Button
				size="lg"
				class="h-11 rounded-xl px-6"
				onclick={() => start(blank)}
			>
				<PlusIcon />
				New rule
			</Button>
		</EmptyState>
	{:else}
		<p class="text-muted-foreground text-sm">
			Applied to every line whose description has the words, when you save a
			rule and to each new line from your bank. A newer rule wins over an older
			one.
		</p>
		<ul
			class="glass divide-border divide-y overflow-hidden rounded-2xl"
			aria-label="Rules"
		>
			{#each data.rules as rule (rule.id)}
				<li>
					<ItemMenu
						title={rule.pattern}
						class="min-h-16 px-3 py-2 md:px-4"
						onOpen={() => start(rule)}
						actions={[
							{
								label: "Edit",
								icon: PencilIcon,
								onSelect: () => start(rule),
							},
							{
								label: "Delete",
								icon: Trash2Icon,
								destructive: true,
								form: {
									action: "?/remove",
									fields: { id: rule.id },
									loading: "Deleting the rule",
									success: "Rule deleted, the lines it filed stay.",
									confirm: {
										title: `Delete the rule for "${rule.pattern}"?`,
										description:
											"The lines it filed keep their category, tag and series.",
										confirmLabel: "Delete",
									},
								},
							},
						]}
					>
						<span
							class="category-tile flex size-11 shrink-0 items-center justify-center rounded-xl"
							style="--category-chroma: 0"
						>
							<WandIcon class="size-5" />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">"{rule.pattern}"</span>
							<span class="text-muted-foreground line-clamp-2 block text-sm"
								>{effects(rule)}</span
							>
						</span>
					</ItemMenu>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<Fab label="New rule" icon={PlusIcon} onclick={() => start(blank)} />

<RuleSheet
	bind:open
	{draft}
	categories={data.categories}
	series={data.series}
	action=""
/>
