<script lang="ts">
	import { enhance } from "$app/forms";
	import PowerOffIcon from "@lucide/svelte/icons/power-off";

	import { Button } from "#lib/components/ui/button/index.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();
</script>

<div class="grid gap-6">
	{#if data.applicationId}
		<form
			method="POST"
			action="?/remove"
			class="glass flex flex-col gap-3 rounded-2xl p-4 md:p-6"
			use:enhance={enhanceToast({
				loading: "Turning bank sync off",
				success: "Bank sync is off.",
			})}
		>
			<h2 class="font-semibold">Turn it off</h2>
			<p class="text-muted-foreground text-sm">
				Forgets your keys. Linked banks stop syncing; the expenses they brought
				stay.
			</p>
			<Button
				type="submit"
				variant="outline"
				class="h-11 self-start rounded-xl px-5"
			>
				<PowerOffIcon />
				Turn off
			</Button>
		</form>
	{:else}
		<p class="glass text-muted-foreground rounded-2xl p-4 text-sm md:p-6">
			Bank sync is already off: no keys are stored for your account.
		</p>
	{/if}
</div>
