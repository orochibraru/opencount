<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import LogInIcon from "@lucide/svelte/icons/log-in";
	import UserPlusIcon from "@lucide/svelte/icons/user-plus";

	import { Button } from "#lib/components/ui/button/index.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	setPageTitle(() => `Join ${data.invited.name}`);

	let memberId = $state("");
</script>

<form
	method="POST"
	class="glass mx-auto flex max-w-md flex-col gap-5 rounded-3xl p-5 md:mt-6 md:p-7"
	use:enhance={enhanceToast({
		loading: "Joining",
		success: `You're in ${data.invited.name}.`,
	})}
>
	<div>
		<h2 class="font-display text-2xl font-semibold">{data.invited.name}</h2>
		<p class="text-muted-foreground mt-1 text-sm">
			You were invited to split expenses in {data.invited.currency}.
			{data.unlinked.length > 0
				? "Already in the list? Pick your name so what you paid stays yours."
				: ""}
		</p>
	</div>

	{#if data.unlinked.length > 0}
		<fieldset class="flex flex-col gap-2">
			<legend class="mb-2 text-sm font-medium">Who are you?</legend>
			{#each [{ id: "", displayName: `I'm new: ${data.user.name}` }, ...data.unlinked] as member (member.id)}
				<label
					class="has-checked:border-primary has-checked:bg-accent flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 transition-colors"
				>
					<input
						type="radio"
						name="memberId"
						value={member.id}
						bind:group={memberId}
						class="sr-only"
					/>
					<span class="flex-1 font-medium">{member.displayName}</span>
					{#if memberId === member.id}<CheckIcon
							class="text-primary size-5"
						/>{/if}
				</label>
			{/each}
		</fieldset>
	{:else}
		<input type="hidden" name="memberId" value="" />
	{/if}

	<Button type="submit" size="lg" class="glow h-12 rounded-xl text-base">
		{#if memberId}<LogInIcon />{:else}<UserPlusIcon />{/if}
		{memberId ? "That's me, join" : "Join the group"}
	</Button>
</form>
