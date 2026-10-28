<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import ArchiveIcon from "@lucide/svelte/icons/archive";
	import ArrowUpRightIcon from "@lucide/svelte/icons/arrow-up-right";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import RotateCcwClockIcon from "@lucide/svelte/icons/rotate-ccw-clock";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import UsersIcon from "@lucide/svelte/icons/users";

	import EmptyState from "#lib/components/empty-state.svelte";
	import Fab from "#lib/components/fab.svelte";
	import NewGroupSheet from "#lib/components/groups/new-group-sheet.svelte";
	import HomeQuestion from "#lib/components/home/home-question.svelte";
	import ItemMenu, { type MenuAction } from "#lib/components/item-menu.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { hueOf } from "#lib/group-hue.js";
	import { formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";

	const { data } = $props();

	setPageTitle("OpenCount", undefined, [
		{
			label: "Archived groups",
			icon: RotateCcwClockIcon,
			href: resolve("/(protected)/archived"),
		},
		{
			label: "New group",
			icon: PlusIcon,
			onSelect: () => (creating = true),
			primary: true,
		},
	]);

	let creating = $state(false);

	$effect(() => {
		if (page.url.searchParams.has("new")) {
			creating = true;
			goto(resolve("/(protected)"), { replace: true });
		}
	});

	function actionsFor(group: (typeof data.groups)[number]): MenuAction[] {
		const actions: MenuAction[] = [
			{
				label: "Open",
				icon: ArrowUpRightIcon,
				onSelect: () =>
					goto(resolve("/(protected)/groups/[groupId]", { groupId: group.id })),
			},
			{
				label: "Settings",
				icon: SettingsIcon,
				onSelect: () =>
					goto(
						resolve("/(protected)/groups/[groupId]/settings", {
							groupId: group.id,
						}),
					),
			},
			{
				label: "Archive",
				icon: ArchiveIcon,
				form: {
					action: `${resolve("/(protected)/groups/[groupId]/settings/general", { groupId: group.id })}?/setArchived`,
					fields: { archived: "true" },
					loading: "Archiving",
					success: `${group.name} archived.`,
				},
			},
		];
		if (group.isOwner) {
			actions.push({
				label: "Delete",
				icon: Trash2Icon,
				destructive: true,
				form: {
					action: "?/delete",
					fields: { id: group.id },
					loading: "Deleting group",
					success: "Group deleted.",
					confirm: {
						title: `Delete ${group.name}?`,
						description: "Every expense and balance in it goes, for everyone.",
						confirmLabel: "Delete group",
					},
				},
			});
		}
		return actions;
	}
</script>

{#if data.askHome}
	<HomeQuestion />
{/if}

{#if data.groups.length === 0}
	<div class="glass mx-auto mt-6 max-w-xl rounded-3xl">
		<EmptyState
			icon={UsersIcon}
			title="Start a group"
			subtitle="One per trip, flat or dinner. Add who's in, then log who paid for what."
		>
			<Button
				size="lg"
				class="glow h-11 rounded-xl px-6"
				onclick={() => (creating = true)}
			>
				<PlusIcon />
				New group
			</Button>
		</EmptyState>
	</div>
{:else}
	<ul
		class="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] md:gap-4"
	>
		{#each data.groups as group (group.id)}
			{@const hue = hueOf(group.name)}
			<li
				class="glass overflow-hidden rounded-2xl transition-transform duration-200 active:scale-[0.98]"
			>
				<ItemMenu
					title={group.name}
					actions={actionsFor(group)}
					class="p-1.5 pr-2"
				>
					<a
						href={resolve("/(protected)/groups/[groupId]", {
							groupId: group.id,
						})}
						class="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2.5"
					>
						<span
							class="font-display flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold text-white shadow-[inset_0_1px_0_oklch(1_0_0/30%)]"
							style="background: linear-gradient(135deg, oklch(0.68 0.15 {hue}), oklch(0.55 0.17 {(hue +
								50) %
								360}))"
							aria-hidden="true"
						>
							{group.name.slice(0, 1).toUpperCase()}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{group.name}</span>
							<span class="text-muted-foreground block truncate text-sm"
								>{group.memberNames.join(", ")}</span
							>
						</span>
						<span class="text-right">
							<span
								class="font-display block font-semibold tabular {group.myBalanceMinor >
								0
									? 'text-positive'
									: group.myBalanceMinor < 0
										? 'text-negative'
										: 'text-muted-foreground'}"
							>
								{group.myBalanceMinor === 0
									? "Settled"
									: formatMoney(Math.abs(group.myBalanceMinor), group.currency)}
							</span>
							{#if group.myBalanceMinor !== 0}
								<span class="text-muted-foreground block text-xs"
									>{group.myBalanceMinor > 0 ? "you're owed" : "you owe"}</span
								>
							{/if}
						</span>
					</a>
				</ItemMenu>
			</li>
		{/each}
	</ul>
{/if}

<Fab label="New group" icon={PlusIcon} onclick={() => (creating = true)} />

<NewGroupSheet bind:open={creating} />
