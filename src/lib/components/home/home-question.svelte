<script lang="ts">
	import { enhance } from "$app/forms";
	import PiggyBankIcon from "@lucide/svelte/icons/piggy-bank";

	import { Button } from "#lib/components/ui/button/index.js";
	import { enhanceToast } from "#lib/toast.js";
</script>

<form
	method="POST"
	action="?/home"
	class="glass mb-6 flex flex-col gap-4 rounded-3xl p-5 md:flex-row md:items-center md:p-6"
	use:enhance={enhanceToast({
		loading: "Saving your choice",
		success: (result) =>
			result?.home === "money"
				? "Home is in your tabs now."
				: "No Home tab. Turn it on under Account, Bank sync.",
	})}
>
	<span
		class="bg-accent text-accent-foreground flex size-12 shrink-0 items-center justify-center rounded-2xl"
	>
		<PiggyBankIcon class="size-6" />
	</span>
	<div class="min-w-0 flex-1">
		<h2 class="font-semibold">Add a Home tab for your money?</h2>
		<p class="text-muted-foreground mt-1 text-sm">
			Your bank is linked. A Home tab can show how you're doing: yesterday's
			spending, a month-end forecast, your habits and what repeats every month.
		</p>
	</div>
	<div class="flex gap-2">
		<Button
			type="submit"
			name="home"
			value="groups"
			variant="ghost"
			class="h-11 flex-1 rounded-xl md:flex-none">No thanks</Button
		>
		<Button
			type="submit"
			name="home"
			value="money"
			class="glow h-11 flex-1 rounded-xl md:flex-none">Add Home</Button
		>
	</div>
</form>
