<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import SparklesIcon from "@lucide/svelte/icons/sparkles";
	import TagIcon from "@lucide/svelte/icons/tag";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";

	import {
		categories,
		categoryOf,
		type CustomCategory,
		customCategoryIcons,
	} from "#lib/categories.js";
	import EmptyState from "#lib/components/empty-state.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { enhanceToast } from "#lib/toast.js";
	import { cn } from "#lib/utils.js";

	const { data } = $props();

	let sheetOpen = $state(false);
	let editing = $state<CustomCategory | undefined>();
	let icon = $state("tag");
	let errors = $state<Record<string, string[]>>({});

	function open(category?: CustomCategory) {
		editing = category;
		icon = category?.icon ?? "tag";
		errors = {};
		sheetOpen = true;
	}

	function uses(value: string): string {
		const total = data.usage[value] ?? 0;
		return total === 1 ? "1 expense" : `${total} expenses`;
	}
</script>

<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
	<section class="flex flex-col gap-3" aria-labelledby="own-heading">
		<div class="flex items-center justify-between gap-3 px-1">
			<div>
				<h2 id="own-heading" class="text-lg font-semibold">This group's</h2>
				<p class="text-muted-foreground text-sm">
					Yours to name. New expenses mentioning the name get it picked.
				</p>
			</div>
			<Button class="glow h-10 shrink-0 rounded-xl px-4" onclick={() => open()}>
				<PlusIcon />
				Add
			</Button>
		</div>
		{#if data.categories.length === 0}
			<div class="glass rounded-2xl">
				<EmptyState
					icon={TagIcon}
					title="No categories of your own"
					subtitle="Add one for what the built-in ones miss, like Rent, Kids or Pets."
				/>
			</div>
		{:else}
			<ul class="glass divide-border divide-y overflow-hidden rounded-2xl">
				{#each data.categories as category (category.id)}
					{@const option = categoryOf(category.id, data.categories)}
					<li>
						<ItemMenu
							title={category.name}
							class="min-h-14 px-3 py-2 md:px-4"
							actions={[
								{
									label: "Edit",
									icon: PencilIcon,
									onSelect: () => open(category),
								},
								{
									label: "Delete",
									icon: Trash2Icon,
									destructive: true,
									form: {
										action: "?/delete",
										fields: { id: category.id },
										loading: "Deleting category",
										success: `${category.name} deleted.`,
										confirm: {
											title: `Delete ${category.name}?`,
											description: `Its ${uses(category.id)} move to Other.`,
											confirmLabel: "Delete",
										},
									},
								},
							]}
						>
							<span
								class="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl"
							>
								<option.icon class="size-5" />
							</span>
							<span class="min-w-0 flex-1 truncate font-medium"
								>{category.name}</span
							>
							<span class="text-muted-foreground text-sm tabular"
								>{uses(category.id)}</span
							>
						</ItemMenu>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="flex flex-col gap-3" aria-labelledby="built-in-heading">
		<form
			method="POST"
			action="?/autoCategorize"
			class="glass flex flex-col gap-3 rounded-2xl p-4 md:p-6"
			use:enhance={enhanceToast({
				loading: "Sorting the expenses",
				success: (result) =>
					Number(result?.moved) > 0
						? `${Number(result?.moved)} ${Number(result?.moved) === 1 ? "expense" : "expenses"} filed.`
						: "Nothing to file: no match for what's left under Other.",
			})}
		>
			<div class="flex items-start gap-3">
				<span
					class="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl"
				>
					<SparklesIcon class="size-5" />
				</span>
				<div>
					<h2 class="font-semibold">Sort what's under Other</h2>
					<p class="text-muted-foreground mt-1 text-sm">
						Files every expense still under Other by its description, its
						merchant and this group's own categories. Ones you filed yourself
						stay where they are.
					</p>
				</div>
			</div>
			<Button
				type="submit"
				variant="secondary"
				class="h-11 self-start rounded-xl"
				disabled={(data.usage.other ?? 0) === 0}
			>
				<SparklesIcon />
				Sort them
			</Button>
		</form>
		<div class="px-1">
			<h2 id="built-in-heading" class="text-lg font-semibold">Built in</h2>
			<p class="text-muted-foreground text-sm">
				Always there, and guessed from words like dinner, taxi or hotel.
			</p>
		</div>
		<ul class="glass divide-border divide-y overflow-hidden rounded-2xl">
			{#each categories as category (category.value)}
				<li class="flex min-h-14 items-center gap-3 px-3 py-2 md:px-4">
					<span
						class="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl"
					>
						<category.icon class="size-5" />
					</span>
					<span class="min-w-0 flex-1 truncate">{category.label}</span>
					<span class="text-muted-foreground text-sm tabular"
						>{uses(category.value)}</span
					>
				</li>
			{/each}
		</ul>
	</section>
</div>

<ResponsiveSheet
	bind:open={sheetOpen}
	title={editing ? `Edit ${editing.name}` : "New category"}
>
	<form
		method="POST"
		action="?/save"
		class="flex flex-col gap-5 pb-4"
		use:enhance={enhanceToast({
			loading: "Saving category",
			success: editing ? "Category saved." : "Category added.",
			onFailure: (result) =>
				(errors = (result?.errors as Record<string, string[]>) ?? {}),
			onSuccess: () => {
				sheetOpen = false;
			},
		})}
	>
		{#if editing}
			<input type="hidden" name="id" value={editing.id} />
		{/if}
		<Field.Field>
			<Field.Label for="category-name">Name</Field.Label>
			<Input
				id="category-name"
				name="name"
				value={editing?.name ?? ""}
				placeholder="Rent"
				required
				maxlength={40}
				class="h-11"
			/>
			<Field.Error errors={errors.name?.map((message) => ({ message }))} />
		</Field.Field>
		<fieldset>
			<legend class="mb-2 text-sm font-medium">Icon</legend>
			<div class="grid grid-cols-6 gap-2">
				{#each Object.entries(customCategoryIcons) as [key, Icon] (key)}
					<label
						class={cn(
							"border-border hover:bg-muted flex aspect-square cursor-pointer items-center justify-center rounded-xl border transition-colors",
							icon === key && "border-primary bg-accent text-accent-foreground",
						)}
						title={key}
					>
						<input
							type="radio"
							name="icon"
							value={key}
							bind:group={icon}
							class="sr-only"
						/>
						<Icon class="size-5" />
						<span class="sr-only">{key}</span>
					</label>
				{/each}
			</div>
		</fieldset>
		<Button type="submit" class="glow h-11 rounded-xl">
			<CheckIcon />
			{editing ? "Save category" : "Add category"}
		</Button>
	</form>
</ResponsiveSheet>
