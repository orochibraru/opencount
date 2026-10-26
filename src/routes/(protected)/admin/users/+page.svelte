<script lang="ts">
	import FingerprintIcon from "@lucide/svelte/icons/fingerprint";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import ShieldMinusIcon from "@lucide/svelte/icons/shield-minus";
	import ShieldPlusIcon from "@lucide/svelte/icons/shield-plus";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";

	import ItemMenu, { type MenuAction } from "#lib/components/item-menu.svelte";
	import { Badge } from "#lib/components/ui/badge/index.js";

	const { data } = $props();

	function actionsFor(user: (typeof data.users)[number]): MenuAction[] {
		const self = user.id === data.user.id;
		const actions: MenuAction[] = [];
		if (!self) {
			actions.push(
				user.role === "admin"
					? {
							label: "Remove admin role",
							icon: ShieldMinusIcon,
							form: {
								action: "?/demote",
								fields: { id: user.id },
								loading: "Updating role",
								success: "Admin role removed.",
								confirm: {
									title: `Remove ${user.name}'s admin role?`,
									description:
										"They keep their account and groups but lose the admin area.",
									confirmLabel: "Remove admin",
								},
							},
						}
					: {
							label: "Make admin",
							icon: ShieldPlusIcon,
							form: {
								action: "?/promote",
								fields: { id: user.id },
								loading: "Updating role",
								success: `${user.name} is now an admin.`,
								confirm: {
									title: `Make ${user.name} an admin?`,
									description:
										"Admins manage invites, sign-in methods, email and every account, yours included.",
									confirmLabel: "Make admin",
								},
							},
						},
			);
		}
		actions.push({
			label: "Sign out everywhere",
			icon: LogOutIcon,
			form: {
				action: "?/revokeSessions",
				fields: { id: user.id },
				loading: "Signing out",
				success: "Signed out everywhere.",
				confirm: {
					title: `Sign ${user.name} out everywhere?`,
					description:
						"Every session on every device ends. They can sign in again.",
					confirmLabel: "Sign out",
				},
			},
		});
		if (!self) {
			actions.push({
				label: "Delete account",
				icon: Trash2Icon,
				destructive: true,
				form: {
					action: "?/delete",
					fields: { id: user.id },
					loading: "Deleting account",
					success: "Account deleted.",
					confirm: {
						title: `Delete ${user.name}'s account?`,
						description:
							"Their sign-in, sessions and security keys are deleted. This can't be undone.",
						confirmLabel: "Delete",
					},
				},
			});
		}
		return actions;
	}
</script>

<ul
	class="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(22rem,1fr))]"
	aria-label="Accounts"
>
	{#each data.users as user (user.id)}
		<li class="glass rounded-2xl">
			<ItemMenu title={user.name} actions={actionsFor(user)} class="p-3 pr-2">
				<span
					class="from-primary flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br to-[oklch(0.62_0.14_calc(var(--hue)+70))] font-semibold text-white"
					aria-hidden="true"
				>
					{user.name.slice(0, 1).toUpperCase()}
				</span>
				<span class="min-w-0 flex-1">
					<span class="flex items-center gap-2 font-medium">
						<span class="truncate">{user.name}</span>
						{#if user.role === "admin"}<Badge>Admin</Badge>{/if}
						{#if user.id === data.user.id}<Badge variant="secondary">You</Badge
							>{/if}
					</span>
					<span class="text-muted-foreground block truncate text-sm"
						>{user.email}</span
					>
					<span class="mt-1.5 flex flex-wrap gap-1.5">
						<Badge variant={user.twoFactorEnabled ? "default" : "outline"}>
							<ShieldCheckIcon />
							{user.twoFactorEnabled ? "Authenticator on" : "No authenticator"}
						</Badge>
						<Badge variant={user.passkeyCount > 0 ? "default" : "outline"}>
							<FingerprintIcon />
							{user.passkeyCount}
							{user.passkeyCount === 1 ? "passkey" : "passkeys"}
						</Badge>
					</span>
				</span>
			</ItemMenu>
		</li>
	{/each}
</ul>
