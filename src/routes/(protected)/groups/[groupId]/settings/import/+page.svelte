<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
	import CheckIcon from "@lucide/svelte/icons/check";
	import ImportIcon from "@lucide/svelte/icons/import";
	import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";

	import EmptyState from "#lib/components/empty-state.svelte";
	import Picker from "#lib/components/picker.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { formatMoney } from "#lib/money.js";
	import { enhanceToast } from "#lib/toast.js";

	interface Preview {
		title: string;
		currency: string;
		participants: string[];
		entries: {
			kind: "expense" | "transfer";
			description: string;
			spentOn: string;
			amountMinor: number;
			paidBy: string;
		}[];
	}

	const { data } = $props();

	let preview = $state<Preview>();
	let mapping = $state<string[]>([]);
	let queued = $state<number>();
	let errors = $state<Record<string, string[]>>({});

	const memberOptions = $derived([
		{ value: "new", label: "Add as a new member" },
		...data.members.map((member) => ({
			value: member.id,
			label: member.displayName,
		})),
	]);

	const summary = $derived.by(() => {
		const entries = preview?.entries ?? [];
		const expenses = entries.filter((entry) => entry.kind === "expense");
		const days = entries.map((entry) => entry.spentOn).toSorted();
		return {
			expenses: expenses.length,
			transfers: entries.length - expenses.length,
			totalMinor: expenses.reduce(
				(total, entry) => total + entry.amountMinor,
				0,
			),
			from: days[0],
			to: days.at(-1),
			latest: entries
				.toSorted((left, right) => right.spentOn.localeCompare(left.spentOn))
				.slice(0, 5),
		};
	});

	function showPreview(next: Preview) {
		preview = next;
		mapping = next.participants.map(
			(name) =>
				data.members.find(
					(member) =>
						member.displayName.trim().toLowerCase() ===
						name.trim().toLowerCase(),
				)?.id ?? "new",
		);
	}

	function startOver() {
		preview = undefined;
		queued = undefined;
		errors = {};
	}
</script>

{#if queued !== undefined}
	<div class="glass mx-auto max-w-xl rounded-3xl">
		<EmptyState
			icon={CheckIcon}
			title="Importing {queued} {queued === 1 ? 'entry' : 'entries'}"
			subtitle="It runs in the background. You get a notification when it's done, and the expenses show up in the group."
		>
			<Button
				href={resolve("/(protected)/groups/[groupId]", {
					groupId: data.group.id,
				})}
				size="lg"
				class="h-11 rounded-xl px-6"
			>
				<ArrowRightIcon />
				Back to the group
			</Button>
		</EmptyState>
	</div>
{:else if preview}
	<form
		method="POST"
		action="?/confirm"
		class="grid gap-6 lg:grid-cols-2 lg:items-start"
		use:enhance={enhanceToast({
			loading: "Starting the import",
			success: "Import started.",
			onFailure: (result) =>
				(errors = (result?.errors as Record<string, string[]>) ?? {}),
			onSuccess: (result) => {
				queued = Number(result?.queued ?? 0);
			},
		})}
	>
		<input type="hidden" name="data" value={JSON.stringify(preview)} />
		<section class="glass flex flex-col gap-4 rounded-2xl p-4 md:p-6">
			<div>
				<h2 class="text-lg font-semibold">{preview.title}</h2>
				<p class="text-muted-foreground mt-1 text-sm">
					{summary.expenses} expenses, {summary.transfers} payments,
					{formatMoney(summary.totalMinor, preview.currency)} spent from {summary.from}
					to {summary.to}. Nothing is written until you import.
				</p>
			</div>
			<ul class="divide-border divide-y text-sm">
				{#each summary.latest as entry, index (index)}
					<li class="flex items-center gap-3 py-2">
						<span class="text-muted-foreground w-24 shrink-0 tabular"
							>{entry.spentOn}</span
						>
						<span class="min-w-0 flex-1 truncate">{entry.description}</span>
						<span class="font-medium tabular"
							>{formatMoney(entry.amountMinor, preview.currency)}</span
						>
					</li>
				{/each}
			</ul>
		</section>

		<section class="glass flex flex-col gap-4 rounded-2xl p-4 md:p-6">
			<div>
				<h2 class="text-lg font-semibold">Who's who</h2>
				<p class="text-muted-foreground mt-1 text-sm">
					Match each person in the Tricount to someone in this group, or add
					them.
				</p>
			</div>
			{#each preview.participants as participant, index (participant)}
				<Field.Field>
					<Field.Label for="map-{index}">{participant}</Field.Label>
					<Picker
						id="map-{index}"
						name="map:{index}"
						label={participant}
						options={memberOptions}
						bind:value={mapping[index]}
					/>
				</Field.Field>
			{/each}
			<Field.Error errors={errors.form?.map((message) => ({ message }))} />
			<div class="flex flex-col-reverse gap-2 md:flex-row">
				<Button variant="outline" class="h-11 rounded-xl" onclick={startOver}>
					<RotateCcwIcon />
					Start over
				</Button>
				<Button type="submit" class="glow h-11 flex-1 rounded-xl">
					<ImportIcon />
					Import {preview.entries.length}
					{preview.entries.length === 1 ? "entry" : "entries"}
				</Button>
			</div>
		</section>
	</form>
{:else}
	<form
		method="POST"
		action="?/preview"
		enctype="multipart/form-data"
		class="glass flex max-w-2xl flex-col gap-5 rounded-2xl p-4 md:p-6"
		use:enhance={enhanceToast({
			loading: "Reading the Tricount",
			success: "Check the preview before importing.",
			onSuccess: (result) => showPreview(result?.preview as Preview),
		})}
	>
		<div>
			<h2 class="text-lg font-semibold">Import from Tricount</h2>
			<p class="text-muted-foreground mt-1 text-sm">
				Expenses, payments, splits, categories and dates come over. It must be
				in {data.group.currency}, like this group.
			</p>
		</div>
		<Field.Field>
			<Field.Label for="tricount-link">Share link</Field.Label>
			<Input
				id="tricount-link"
				name="link"
				type="url"
				inputmode="url"
				placeholder="https://tricount.com/…"
				class="h-11"
			/>
			<Field.Description
				>In Tricount: open it, then Share. This server reads it from Tricount.</Field.Description
			>
		</Field.Field>
		<Field.Field>
			<Field.Label for="tricount-file">Or a saved Tricount file</Field.Label>
			<Input
				id="tricount-file"
				name="file"
				type="file"
				accept="application/json,.json"
				class="h-11 pt-2.5"
			/>
			<Field.Description
				>The JSON Tricount's API returns for the link, as exporter tools save
				it.</Field.Description
			>
		</Field.Field>
		<Button type="submit" class="h-11 self-start rounded-xl px-5">
			<ArrowRightIcon />
			Preview
		</Button>
	</form>
{/if}
