import { resolve } from "$app/paths";
import FileDownIcon from "@lucide/svelte/icons/file-down";
import ImportIcon from "@lucide/svelte/icons/import";
import RepeatIcon from "@lucide/svelte/icons/repeat";
import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
import TagIcon from "@lucide/svelte/icons/tag";
import UsersIcon from "@lucide/svelte/icons/users";

import type { SectionTab } from "#lib/components/nav-cards.svelte";

/** A group's settings sections, shared by its landing cards and its tabs. */
export function groupSettingsTabs(groupId: string): SectionTab[] {
	return [
		{
			href: resolve("/(protected)/groups/[groupId]/settings/general", {
				groupId,
			}),
			label: "General",
			description: "Name, currency, or delete the group.",
			icon: SlidersHorizontalIcon,
		},
		{
			href: resolve("/(protected)/groups/[groupId]/settings/members", {
				groupId,
			}),
			label: "Members",
			description: "Who's in, and which account each person is.",
			icon: UsersIcon,
		},
		{
			href: resolve("/(protected)/groups/[groupId]/settings/categories", {
				groupId,
			}),
			label: "Categories",
			description:
				"Add your own, like Rent or Kids, next to the built-in ones.",
			icon: TagIcon,
		},
		{
			href: resolve("/(protected)/groups/[groupId]/settings/repeating", {
				groupId,
			}),
			label: "Repeating",
			description:
				"Rent, subscriptions and other expenses added on a schedule.",
			icon: RepeatIcon,
		},
		{
			href: resolve("/(protected)/groups/[groupId]/settings/import", {
				groupId,
			}),
			label: "Import",
			description: "Bring a Tricount over with its expenses and splits.",
			icon: ImportIcon,
		},
		{
			href: resolve("/(protected)/groups/[groupId]/settings/export", {
				groupId,
			}),
			label: "Export",
			description: "Every expense as a spreadsheet, or a PDF summary.",
			icon: FileDownIcon,
		},
	];
}
