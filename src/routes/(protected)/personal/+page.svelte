<script lang="ts">
	import { enhance } from "$app/forms";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import ChartColumnIcon from "@lucide/svelte/icons/chart-column";
	import CheckIcon from "@lucide/svelte/icons/check";
	import FolderIcon from "@lucide/svelte/icons/folder";
	import FolderPlusIcon from "@lucide/svelte/icons/folder-plus";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import TagsIcon from "@lucide/svelte/icons/tags";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast } from "#lib/toast.js";

	import BanksCard from "./banks-card.svelte";
	import PersonalView from "./personal-view.svelte";

	const { data } = $props();

	let adding = $state(false);
	let folderOpen = $state(false);
	let folderErrors = $state<Record<string, string[]>>({});

	setPageTitle("Personal", undefined, [
		{
			label: "Insights",
			icon: ChartColumnIcon,
			href: resolve("/(protected)/personal/analytics"),
		},
		{
			label: "Categories",
			icon: TagsIcon,
			href: resolve("/(protected)/personal/categories"),
		},
		{
			label: "New folder",
			icon: FolderPlusIcon,
			onSelect: () => (folderOpen = true),
		},
		{
			label: "Bank accounts",
			icon: LandmarkIcon,
			onSelect: () => {
				const card = document.getElementById("bank-accounts");
				if (card) {
					card.scrollIntoView({ behavior: "smooth" });
				} else {
					void goto(resolve("/(protected)/account/banks"));
				}
			},
		},
		{
			label: "Add expense",
			icon: PlusIcon,
			onSelect: () => (adding = true),
			primary: true,
		},
	]);

	onMount(() => {
		const outcome = page.url.searchParams.get("bank");
		if (outcome === "connected") {
			toast.success("Bank linked. Its payments show up in a moment.");
		} else if (outcome === "failed") {
			toast.error("The bank refused the link. Try again.");
		} else if (outcome === "cancelled") {
			toast.error("The bank link was cancelled.");
		}
	});
</script>

<PersonalView
	expenses={data.expenses}
	hasMore={data.hasMore}
	matching={data.matching}
	pageSize={data.pageSize}
	stats={data.stats}
	categories={data.categories}
	category={data.category}
	search={data.search}
	accounts={data.accounts}
	bank={data.bank}
	account={data.account}
	folders={data.folders}
	shareGroups={data.shareGroups}
	defaultCurrency={data.defaultCurrency}
	empty="Track what you spend on your own, apart from your groups, in folders for each project if you like."
	bind:adding
>
	{#snippet aside()}
		{#if data.bankSyncAvailable}
			<BanksCard connections={data.connections} />
		{/if}
	{/snippet}
</PersonalView>

<ResponsiveSheet bind:open={folderOpen} title="New folder">
	<form
		method="POST"
		action="?/saveFolder"
		class="flex flex-col gap-4 pb-4"
		use:enhance={enhanceToast({
			loading: "Making the folder",
			success: "Folder ready.",
			reset: true,
			onFailure: (result) =>
				(folderErrors = (result?.errors as Record<string, string[]>) ?? {}),
			onSuccess: () => {
				folderErrors = {};
				folderOpen = false;
			},
		})}
	>
		<Field.Field>
			<Field.Label for="folder-name">Name</Field.Label>
			<Input
				id="folder-name"
				name="name"
				required
				maxlength={60}
				placeholder="Kitchen renovation"
				class="h-11"
			/>
			<Field.Error
				errors={folderErrors.name?.map((message) => ({ message }))}
			/>
		</Field.Field>
		<Button type="submit" class="h-11 rounded-xl">
			<CheckIcon />
			Make the folder
		</Button>
	</form>
</ResponsiveSheet>
