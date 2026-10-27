<script lang="ts">
	import { resolve } from "$app/paths";
	import KeyRoundIcon from "@lucide/svelte/icons/key-round";

	import { Button } from "#lib/components/ui/button/index.js";

	import LinkedBanks from "./linked-banks.svelte";

	const { data } = $props();
</script>

<div class="grid gap-6">
	{#if data.applicationId}
		<LinkedBanks connections={data.connections} />
	{:else}
		<section class="glass flex flex-col gap-3 rounded-2xl p-4 md:p-6">
			<h2 class="font-semibold">Set up bank sync first</h2>
			<p class="text-muted-foreground text-sm">
				Linking a bank goes through your own Enable Banking application. Add its
				keys, then come back to link your banks.
			</p>
			<Button
				href={resolve("/(protected)/account/banks/setup")}
				variant="secondary"
				class="h-11 self-start rounded-xl px-5"
			>
				<KeyRoundIcon />
				Add my keys
			</Button>
		</section>
	{/if}
</div>
