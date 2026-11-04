<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import InboxIcon from "@lucide/svelte/icons/inbox";
	import SkipForwardIcon from "@lucide/svelte/icons/skip-forward";

	import { categoryOptions, categoryStyle } from "#lib/categories.js";
	import EmptyState from "#lib/components/empty-state.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { Switch } from "#lib/components/ui/switch/index.js";
	import { formatFlow } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	setPageTitle("To sort", resolve("/(protected)/personal"));

	let skipped = $state<string[]>([]);
	let everyLine = $state(true);
	let pattern = $state("");

	const options = $derived(
		categoryOptions(data.categories).filter(
			(option) =>
				option.value !== "other" &&
				option.value !== "internal" &&
				option.value !== "income",
		),
	);
	const current = $derived(
		data.queue.find((entry) => !skipped.includes(entry.id)),
	);
	const accountNames = $derived(
		new Map(data.accounts.map((account) => [account.id, account.name])),
	);

	$effect(() => {
		pattern = current?.description ?? "";
	});

	function day(value: string): string {
		return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
			weekday: "short",
			day: "numeric",
			month: "short",
		});
	}
</script>

<div class="flex flex-col gap-4 px-4 md:max-w-2xl md:px-6">
	{#if !current}
		<EmptyState
			icon={InboxIcon}
			title="Nothing left to sort"
			subtitle={data.left > 0
				? "You skipped the rest. Come back to them anytime."
				: "Every line has a category. New ones from your bank land here when the app can't tell."}
		/>
	{:else}
		<p class="text-muted-foreground text-sm">
			{data.left}
			{data.left === 1 ? "line" : "lines"} without a category
		</p>
		<form
			method="POST"
			action="?/file"
			class="glass flex flex-col gap-4 rounded-2xl p-4 md:p-6"
			use:enhance={enhanceToast({
				loading: "Filing it",
				success: (result) =>
					Number(result?.applied) > 0
						? `Filed, with ${Number(result?.applied)} more like it.`
						: "Filed.",
			})}
		>
			<input type="hidden" name="id" value={current.id} />
			<div>
				<p class="text-muted-foreground text-sm">
					{[
						day(current.spentOn),
						accountNames.get(current.bankAccountUid ?? ""),
					]
						.filter(Boolean)
						.join(" · ")}
				</p>
				<p class="mt-1 text-lg font-semibold wrap-break-word">
					{current.description}
				</p>
				<p class="font-display mt-1 text-3xl font-semibold tabular">
					{formatFlow(current.amountMinor, current.currency, false)}
				</p>
			</div>
			<Field.Field orientation="horizontal">
				<Field.Content>
					<Field.Label for="every-line">Every line like it</Field.Label>
					<Field.Description
						>Now and in every sync, as a rule.</Field.Description
					>
				</Field.Content>
				<Switch id="every-line" bind:checked={everyLine} />
				<input type="hidden" name="rule" value={String(everyLine)} />
			</Field.Field>
			{#if everyLine}
				<Field.Field>
					<Field.Label for="rule-pattern">When the description has</Field.Label>
					<Input
						id="rule-pattern"
						name="pattern"
						maxlength={60}
						class="h-11"
						bind:value={pattern}
					/>
					<Field.Description
						>Cut what changes each time, like a reference number.</Field.Description
					>
				</Field.Field>
			{/if}
			<fieldset>
				<legend class="mb-2 text-sm font-medium">Pick a category</legend>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{#each options as option (option.value)}
						<button
							type="submit"
							name="category"
							value={option.value}
							class="hover:bg-muted flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm"
						>
							<span
								class="category-tile flex size-7 shrink-0 items-center justify-center rounded-lg"
								style={categoryStyle(option)}
							>
								<option.icon class="size-4" />
							</span>
							<span class="min-w-0 truncate">{option.label}</span>
						</button>
					{/each}
				</div>
			</fieldset>
			<Button
				type="button"
				variant="secondary"
				class="h-11 rounded-xl"
				onclick={() => (skipped = [...skipped, current.id])}
			>
				<SkipForwardIcon />
				Skip for now
			</Button>
		</form>
	{/if}
</div>
