<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import KeyRoundIcon from "@lucide/svelte/icons/key-round";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	import LinkedBanks from "#lib/components/account/linked-banks.svelte";
	import { Button } from "#lib/components/ui/button/index.js";

	const { data } = $props();

	const outcomes: Record<string, [kind: "success" | "error", message: string]> =
		{
			connected: ["success", "Bank linked. Its payments show up in a moment."],
			relinked: [
				"success",
				"Bank relinked. Fetching all the history your bank keeps.",
			],
			failed: ["error", "The bank refused the link. Try again."],
			cancelled: ["error", "The bank link was cancelled."],
			empty: [
				"error",
				"Your bank shared no account, so nothing was linked. Try again and pick your accounts if your bank asks.",
			],
			unreadable: [
				"error",
				"Enable Banking can't read these accounts, so nothing was linked. If your app was activated by linking your own accounts, add them in the Enable Banking control panel first.",
			],
		};

	onMount(() => {
		const outcome = outcomes[page.url.searchParams.get("link") ?? ""];
		if (outcome) {
			toast[outcome[0]](outcome[1], { duration: 10_000 });
		}
	});
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
