<script lang="ts">
	import { enhance } from "$app/forms";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import CalendarRangeIcon from "@lucide/svelte/icons/calendar-range";
	import ChartColumnIcon from "@lucide/svelte/icons/chart-column";
	import CheckIcon from "@lucide/svelte/icons/check";
	import FolderIcon from "@lucide/svelte/icons/folder";
	import FolderPlusIcon from "@lucide/svelte/icons/folder-plus";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import TagsIcon from "@lucide/svelte/icons/tags";
	import { untrack } from "svelte";

	import PersonalView from "#lib/components/personal/personal-view.svelte";
	import Picker from "#lib/components/picker.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { monthStartDays } from "#lib/pay-month.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	let adding = $state(false);
	let folderOpen = $state(false);
	let monthOpen = $state(false);
	let monthStart = $state("1");

	const monthStartOptions = Array.from(
		{ length: monthStartDays },
		(_, index) => ({
			value: String(index + 1),
			label: index === 0 ? "Day 1 (calendar months)" : `Day ${index + 1}`,
		}),
	);
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
			label: "Month start",
			icon: CalendarRangeIcon,
			onSelect: () => {
				monthStart = String(data.monthStartDay);
				monthOpen = true;
			},
		},
		{
			label: "New folder",
			icon: FolderPlusIcon,
			onSelect: () => (folderOpen = true),
		},
		...(untrack(() => data.bankSyncEnabled)
			? [
					{
						label: "Bank accounts",
						icon: LandmarkIcon,
						href: resolve("/(protected)/account/banks/linked"),
					},
				]
			: []),
		{
			label: "Add expense",
			icon: PlusIcon,
			onSelect: () => (adding = true),
			primary: true,
		},
	]);
</script>

<PersonalView
	expenses={data.expenses}
	hasMore={data.hasMore}
	matching={data.matching}
	pageSize={data.pageSize}
	stats={data.stats}
	monthStartDay={data.monthStartDay}
	categories={data.categories}
	category={data.category}
	search={data.search}
	accounts={data.accounts}
	bank={data.bank}
	account={data.account}
	folders={data.folders}
	banks={data.banks}
	shareGroups={data.shareGroups}
	defaultCurrency={data.defaultCurrency}
	empty="Track what you spend on your own, apart from your groups, in folders for each project if you like."
	bind:adding
></PersonalView>

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

<ResponsiveSheet
	bind:open={monthOpen}
	title="Month start"
	description="Make your months run payday to payday: totals, the Home tab and Insights count each month from this day to the day before it comes back."
>
	<form
		method="POST"
		action="?/monthStart"
		class="flex flex-col gap-4 pb-4"
		use:enhance={enhanceToast({
			loading: "Saving your month",
			success: "Your months follow your payday now.",
			onSuccess: () => {
				monthOpen = false;
			},
		})}
	>
		<Field.Field>
			<Field.Label for="month-start">My month starts on</Field.Label>
			<Picker
				id="month-start"
				name="monthStartDay"
				label="Month start"
				options={monthStartOptions}
				bind:value={monthStart}
			/>
		</Field.Field>
		<Button type="submit" class="h-11 rounded-xl">
			<CheckIcon />
			Save
		</Button>
	</form>
</ResponsiveSheet>
