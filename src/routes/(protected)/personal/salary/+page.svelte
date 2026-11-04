<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import BanknoteIcon from "@lucide/svelte/icons/banknote";
	import CheckIcon from "@lucide/svelte/icons/check";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import WandIcon from "@lucide/svelte/icons/wand-sparkles";

	import DateField from "#lib/components/date-field.svelte";
	import RuleSheet, {
		type RuleDraft,
	} from "#lib/components/personal/rule-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	setPageTitle("Salary", resolve("/(protected)/personal"));

	let draft = $state<RuleDraft>({
		id: "",
		pattern: "",
		category: null,
		tag: null,
		pay: true,
		recurringId: null,
	});
	let open = $state(false);
	let expected = $state("");

	$effect(() => {
		expected = data.expectedPayday ?? "";
	});

	function day(value: string): string {
		return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
			weekday: "short",
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}
</script>

<div class="flex flex-col gap-4 px-4 md:max-w-2xl md:px-6">
	<section class="glass rounded-2xl p-4 md:p-6" aria-label="Next payday">
		<p class="text-muted-foreground text-sm">Next payday</p>
		<p class="font-display mt-1 text-3xl font-semibold">
			{day(data.nextPayday)}
		</p>
		{#if !data.fromPay}
			<p class="text-muted-foreground mt-2 text-sm">
				Your months don't follow your pay yet, so this is the start of your next
				month. Pick <a
					href={resolve("/(protected)/personal")}
					class="text-primary font-medium">Month start</a
				> in Personal's menu, then The day my pay comes in.
			</p>
		{/if}
		<form
			method="POST"
			action="?/expected"
			class="mt-4 flex flex-col gap-3"
			use:enhance={enhanceToast({
				loading: "Saving",
				success: "Saved.",
			})}
		>
			<Field.Field>
				<Field.Label for="expected-payday">Expect the next one on</Field.Label>
				<DateField
					id="expected-payday"
					name="expectedPayday"
					label="Next payday"
					bind:value={expected}
				/>
				<Field.Description
					>When it lands on another day than usual. Leave it empty to let the
					app work it out from your past paydays.</Field.Description
				>
			</Field.Field>
			<div class="flex gap-2">
				<Button type="submit" class="h-11 flex-1 rounded-xl">
					<CheckIcon />
					Save
				</Button>
				{#if data.expectedPayday}
					<Button
						type="submit"
						name="clear"
						value="true"
						variant="secondary"
						class="h-11 rounded-xl">Clear</Button
					>
				{/if}
			</div>
		</form>
	</section>

	<section class="glass rounded-2xl p-4 md:p-6" aria-label="Salary rules">
		<h2 class="font-semibold">What counts as pay</h2>
		<p class="text-muted-foreground mt-1 text-sm">
			Money in whose description has these words is your pay, now and in every
			sync. You can also pick This is my pay on an income line.
		</p>
		{#if data.rules.length > 0}
			<ul class="divide-border mt-2 divide-y">
				{#each data.rules as rule (rule.id)}
					<li>
						<button
							type="button"
							class="flex min-h-12 w-full items-center gap-3 text-left"
							onclick={() => {
								draft = rule;
								open = true;
							}}
						>
							<WandIcon class="text-muted-foreground size-4 shrink-0" />
							<span class="min-w-0 flex-1 truncate font-medium"
								>"{rule.pattern}"</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<Button
			variant="secondary"
			class="mt-3 h-11 rounded-xl"
			onclick={() => {
				draft = {
					id: "",
					pattern: "",
					category: null,
					tag: null,
					pay: true,
					recurringId: null,
				};
				open = true;
			}}
		>
			<PlusIcon />
			Add a salary rule
		</Button>
	</section>

	<section class="glass rounded-2xl p-4 md:p-6" aria-label="Paydays">
		<h2 class="font-semibold">Paydays found</h2>
		{#if data.paydays.length === 0}
			<p class="text-muted-foreground mt-1 text-sm">
				None yet: add a salary rule or mark an income line as your pay.
			</p>
		{:else}
			<ul class="mt-2 flex flex-col gap-2 text-sm">
				{#each data.paydays as payday (payday)}
					<li class="flex items-center gap-2">
						<BanknoteIcon class="text-muted-foreground size-4 shrink-0" />
						{day(payday)}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<RuleSheet
	bind:open
	{draft}
	categories={data.categories}
	series={data.series}
	action=""
/>
