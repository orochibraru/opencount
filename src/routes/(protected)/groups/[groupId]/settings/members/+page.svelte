<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import LinkIcon from "@lucide/svelte/icons/link";
	import Link2OffIcon from "@lucide/svelte/icons/link-2-off";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
	import Share2Icon from "@lucide/svelte/icons/share-2";
	import UserCheckIcon from "@lucide/svelte/icons/user-check";
	import UserMinusIcon from "@lucide/svelte/icons/user-minus";
	import UserPlusIcon from "@lucide/svelte/icons/user-plus";
	import { toast } from "svelte-sonner";

	import CopyField from "#lib/components/copy-field.svelte";
	import ItemMenu, { type MenuAction } from "#lib/components/item-menu.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Badge } from "#lib/components/ui/badge/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { formatMoney } from "#lib/money.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	let errors = $state<Record<string, string[]>>({});
	let renaming = $state<{ id: string; displayName: string } | undefined>();
	let renameOpen = $state(false);

	type Member = (typeof data.members)[number];

	const canShare = typeof navigator !== "undefined" && "share" in navigator;

	async function shareInviteCallback() {
		try {
			await navigator.share({
				title: data.group.name,
				text: `Join ${data.group.name} on OpenCount`,
				url: data.inviteUrl ?? "",
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return;
			}
			throw error;
		}
	}

	function handleShareInvite() {
		toast.promise(shareInviteCallback(), {
			loading: "Opening the share sheet",
			success: "Invite link ready to send.",
			error: "Couldn't share. Copy the link instead.",
		});
	}

	function actionsFor(member: Member): MenuAction[] {
		if (member.id === data.myMemberId) {
			const renameMe: MenuAction = {
				label: "Change my name",
				icon: PencilIcon,
				onSelect: () => {
					renaming = member;
					renameOpen = true;
				},
			};
			return data.isOwner
				? [renameMe]
				: [
						renameMe,
						{
							label: "Leave group",
							icon: LogOutIcon,
							destructive: true,
							form: {
								action: "?/leave",
								fields: {},
								loading: "Leaving the group",
								success: `You left ${data.group.name}.`,
								confirm: {
									title: `Leave ${data.group.name}?`,
									description:
										"Your expenses stay under your name, but the group disappears from your list until someone adds you back.",
									confirmLabel: "Leave",
								},
							},
						},
					];
		}
		return [
			...(member.userId
				? []
				: [
						{
							label: "That's me",
							icon: UserCheckIcon,
							form: {
								action: "?/claim",
								fields: { id: member.id },
								loading: "Linking your account",
								success: `You're ${member.displayName} now.`,
								confirm: {
									title: `Are you ${member.displayName}?`,
									description: `What you paid and shared here moves to ${member.displayName}, and ${member.displayName} becomes your account in this group.`,
									confirmLabel: "That's me",
								},
							},
						} satisfies MenuAction,
					]),
			{
				label: "Rename",
				icon: PencilIcon,
				onSelect: () => {
					renaming = member;
					renameOpen = true;
				},
			},
			{
				label: "Remove from group",
				icon: UserMinusIcon,
				destructive: true,
				form: {
					action: "?/remove",
					fields: { id: member.id },
					loading: "Removing member",
					success: "Member removed.",
					confirm: {
						title: `Remove ${member.displayName}?`,
						description: "Only possible while they aren't part of any expense.",
						confirmLabel: "Remove",
					},
				},
			},
		];
	}
</script>

<div class="grid gap-6 lg:grid-cols-[1fr_minmax(20rem,26rem)] lg:items-start">
	<ul
		class="glass divide-border divide-y overflow-hidden rounded-2xl"
		aria-label="Members"
	>
		{#each data.members as member (member.id)}
			{@const balance = data.balances[member.id] ?? 0}
			<li>
				<ItemMenu
					title={member.displayName}
					class="min-h-16 px-3 py-2 md:px-4"
					actions={actionsFor(member)}
				>
					<span
						class="from-primary flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br to-[oklch(0.62_0.14_calc(var(--hue)+70))] text-sm font-semibold text-white"
						aria-hidden="true"
					>
						{member.displayName.slice(0, 1).toUpperCase()}
					</span>
					<span class="min-w-0 flex-1">
						<span class="flex items-center gap-2 font-medium">
							<span class="truncate">{member.displayName}</span>
							{#if member.id === data.myMemberId}<Badge variant="secondary"
									>You</Badge
								>{/if}
						</span>
						<span
							class="text-muted-foreground flex items-center gap-1 truncate text-sm"
						>
							{#if member.email}
								<LinkIcon class="size-3.5 shrink-0" />
								{member.email}
							{:else}
								No account linked
							{/if}
						</span>
					</span>
					<span
						class="text-sm font-semibold tabular {balance > 0
							? 'text-positive'
							: balance < 0
								? 'text-negative'
								: 'text-muted-foreground'}"
					>
						{formatMoney(balance, data.group.currency, { signed: true })}
					</span>
				</ItemMenu>
			</li>
		{/each}
	</ul>

	<div class="flex min-w-0 flex-col gap-6">
		<section class="glass flex flex-col gap-4 rounded-2xl p-4 md:p-6">
			<div>
				<h2 class="text-lg font-semibold">Invite link</h2>
				<p class="text-muted-foreground mt-1 text-sm">
					Anyone with an account here who opens it joins the group, or picks
					their name if you already added them.
				</p>
			</div>
			{#if data.inviteUrl}
				<CopyField value={data.inviteUrl} label="Copy invite link" />
				<div class="flex flex-wrap gap-2">
					{#if canShare}
						<Button
							variant="secondary"
							class="h-11 rounded-xl"
							onclick={handleShareInvite}
						>
							<Share2Icon />
							Share
						</Button>
					{/if}
					<form
						method="POST"
						action="?/resetInvite"
						use:enhance={enhanceToast({
							loading: "Making a new link",
							success: "New link ready. The old one stopped working.",
						})}
					>
						<Button type="submit" variant="outline" class="h-11 rounded-xl">
							<RefreshCwIcon />
							New link
						</Button>
					</form>
					<form
						method="POST"
						action="?/disableInvite"
						use:enhance={enhanceToast({
							loading: "Turning the link off",
							success: "Invite link turned off.",
						})}
					>
						<Button type="submit" variant="ghost" class="h-11 rounded-xl">
							<Link2OffIcon />
							Turn off
						</Button>
					</form>
				</div>
			{:else}
				<form
					method="POST"
					action="?/resetInvite"
					use:enhance={enhanceToast({
						loading: "Making a link",
						success: "Invite link ready to share.",
					})}
				>
					<Button
						type="submit"
						variant="secondary"
						class="h-11 w-full rounded-xl"
					>
						<LinkIcon />
						Create an invite link
					</Button>
				</form>
			{/if}
		</section>

		<form
			method="POST"
			action="?/add"
			class="glass flex flex-col gap-4 rounded-2xl p-4 md:p-6"
			use:enhance={enhanceToast({
				loading: "Adding member",
				success: "Member added.",
				reset: true,
				onFailure: (result) =>
					(errors = (result?.errors as Record<string, string[]>) ?? {}),
				onSuccess: () => {
					errors = {};
				},
			})}
		>
			<div>
				<h2 class="text-lg font-semibold">Add someone</h2>
				<p class="text-muted-foreground mt-1 text-sm">
					A name is enough. Link their account so the group shows up for them
					too.
				</p>
			</div>
			<Field.Field>
				<Field.Label for="member-name">Name</Field.Label>
				<Input
					id="member-name"
					name="displayName"
					required
					maxlength={60}
					placeholder="Sam"
					class="h-11"
				/>
				<Field.Error
					errors={errors.displayName?.map((message) => ({ message }))}
				/>
			</Field.Field>
			<Field.Field>
				<Field.Label for="member-email">Their account email</Field.Label>
				<Input
					id="member-email"
					name="email"
					type="email"
					inputmode="email"
					placeholder="Optional"
					class="h-11"
				/>
				<Field.Error errors={errors.email?.map((message) => ({ message }))} />
			</Field.Field>
			<Button type="submit" class="glow h-11 rounded-xl">
				<UserPlusIcon />
				Add to group
			</Button>
		</form>
	</div>
</div>

{#if renaming}
	<ResponsiveSheet
		bind:open={renameOpen}
		title={renaming.id === data.myMemberId
			? `Your name in ${data.group.name}`
			: `Rename ${renaming.displayName}`}
		description={renaming.id === data.myMemberId
			? "Only this group sees it. Your account name stays the same."
			: undefined}
	>
		<form
			method="POST"
			action="?/rename"
			class="flex flex-col gap-4 pb-4"
			use:enhance={enhanceToast({
				loading: "Renaming",
				success: "Renamed.",
				onSuccess: () => {
					renameOpen = false;
				},
			})}
		>
			<input type="hidden" name="id" value={renaming.id} />
			<Field.Field>
				<Field.Label for="rename-member">Name</Field.Label>
				<Input
					id="rename-member"
					name="displayName"
					value={renaming.displayName}
					required
					maxlength={60}
					class="h-11"
				/>
			</Field.Field>
			<Button type="submit" class="h-11 rounded-xl">
				<CheckIcon />
				Save name
			</Button>
		</form>
	</ResponsiveSheet>
{/if}
