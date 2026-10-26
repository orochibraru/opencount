import { resolve } from "$app/paths";
import ShieldIcon from "@lucide/svelte/icons/shield";
import UserRoundIcon from "@lucide/svelte/icons/user-round";
import UsersIcon from "@lucide/svelte/icons/users";
import WalletIcon from "@lucide/svelte/icons/wallet";
import type { Component } from "svelte";

export interface NavigationItem {
	href: string;
	label: string;
	icon: Component<{ class?: string }>;
}

/** The app's top-level destinations, shared by the bottom tab bar and the desktop top bar; admins also get Admin. */
export function navigationItems(isAdmin: boolean): NavigationItem[] {
	const items = [
		{ href: resolve("/(protected)"), label: "Groups", icon: UsersIcon },
		{
			href: resolve("/(protected)/personal"),
			label: "Personal",
			icon: WalletIcon,
		},
		{
			href: resolve("/(protected)/account"),
			label: "Account",
			icon: UserRoundIcon,
		},
	];
	if (isAdmin) {
		items.push({
			href: resolve("/(protected)/admin"),
			label: "Admin",
			icon: ShieldIcon,
		});
	}
	return items;
}

/** Whether `pathname` sits under the destination at `href`. */
export function isActive(pathname: string, href: string): boolean {
	return href === "/"
		? pathname === "/" ||
				pathname === "/archived" ||
				pathname.startsWith("/groups/")
		: pathname === href || pathname.startsWith(`${href}/`);
}
