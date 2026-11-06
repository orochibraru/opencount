import { resolve } from "$app/paths";
import HouseIcon from "@lucide/svelte/icons/house";
import KeyRoundIcon from "@lucide/svelte/icons/key-round";
import LandmarkIcon from "@lucide/svelte/icons/landmark";
import PowerOffIcon from "@lucide/svelte/icons/power-off";
import WalletIcon from "@lucide/svelte/icons/wallet";

import type { SectionTab } from "#lib/components/nav-cards.svelte";

/** The bank sync section's pages, shared by its landing cards and its tabs; only Accounts while bank sync is off. */
export function bankSyncTabs(enabled: boolean): SectionTab[] {
	const accounts = {
		href: resolve("/(protected)/account/banks/accounts"),
		label: "Accounts",
		description: "Balances, types, shared accounts and accounts added by hand.",
		icon: WalletIcon,
	};
	if (!enabled) {
		return [accounts];
	}
	return [
		accounts,
		{
			href: resolve("/(protected)/account/banks/linked"),
			label: "Linked banks",
			description: "Your banks, where each sync stands, and linking another.",
			icon: LandmarkIcon,
		},
		{
			href: resolve("/(protected)/account/banks/setup"),
			label: "Bank sync",
			description: "Your Enable Banking keys, and how to get them.",
			icon: KeyRoundIcon,
		},
		{
			href: resolve("/(protected)/account/banks/home"),
			label: "Home",
			description: "Whether the app opens on your money or your groups.",
			icon: HouseIcon,
		},
		{
			href: resolve("/(protected)/account/banks/turn-off"),
			label: "Turn off",
			description: "Forget your keys and stop every sync.",
			icon: PowerOffIcon,
		},
	];
}
