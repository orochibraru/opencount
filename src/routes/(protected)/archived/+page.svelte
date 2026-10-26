<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import ArchiveIcon from "@lucide/svelte/icons/archive";
	import ArchiveRestoreIcon from "@lucide/svelte/icons/archive-restore";
	import ArrowUpRightIcon from "@lucide/svelte/icons/arrow-up-right";

	import EmptyState from "#lib/components/empty-state.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import { hueOf } from "#lib/group-hue.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";

	const { data } = $props();

	setPageTitle("Archived groups", resolve("/(protected)"));
</script>

{#if data.archived.length === 0}
	<div class="glass mx-auto mt-6 max-w-xl rounded-3xl">
		<EmptyState
			icon={ArchiveIcon}
			title="Nothing archived"
			subtitle="Archive a group you're done with from its menu or its settings. It lands here, only for you."
		/>
	</div>
{:else}
	<ul class="glass divide-border divide-y overflow-hidden rounded-2xl">
		{#each data.archived as group (group.id)}
			{@const href = resolve("/(protected)/groups/[groupId]", {
				groupId: group.id,
			})}
			<li>
				<ItemMenu
					title={group.name}
					class="min-h-16 px-3 py-2 md:px-4"
					actions={[
						{
							label: "Open",
							icon: ArrowUpRightIcon,
							onSelect: () => goto(href),
						},
						{
							label: "Unarchive",
							icon: ArchiveRestoreIcon,
							form: {
								action: `${href}/settings/general?/setArchived`,
								fields: { archived: "false" },
								loading: "Bringing it back",
								success: `${group.name} is back in your groups.`,
							},
						},
					]}
				>
					<a {href} class="flex min-w-0 flex-1 items-center gap-3">
						<span
							class="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
							style="background: oklch(0.62 0.13 {hueOf(group.name)})"
							aria-hidden="true">{group.name.slice(0, 1).toUpperCase()}</span
						>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{group.name}</span>
							<span class="text-muted-foreground block text-sm"
								>{group.memberCount}
								{group.memberCount === 1 ? "person" : "people"}, {group.currency}</span
							>
						</span>
					</a>
				</ItemMenu>
			</li>
		{/each}
	</ul>
{/if}
