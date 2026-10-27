<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";

	import SettingSwitch from "#lib/components/setting-switch.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { saveToast } from "#lib/toast.js";

	const { data } = $props();
</script>

<div class="grid gap-6">
	<form
		method="POST"
		action="?/home"
		class="glass flex flex-col gap-4 rounded-2xl p-4 md:p-6"
		use:enhance={saveToast("Home tab")}
	>
		<SettingSwitch
			name="moneyHome"
			label="Home tab"
			description="A Home tab with how you're doing: yesterday's spending, a month-end forecast, your habits and what repeats every month."
			checked={data.moneyHome}
		/>
		<Button
			type="submit"
			variant="secondary"
			class="h-11 self-start rounded-xl px-5"
		>
			<CheckIcon />
			Save
		</Button>
	</form>
</div>
