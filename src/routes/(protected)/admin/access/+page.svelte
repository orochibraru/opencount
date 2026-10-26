<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";

	import SettingSwitch from "#lib/components/setting-switch.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { saveToast } from "#lib/toast.js";

	const { data } = $props();
</script>

<form
	method="POST"
	class="grid gap-6 lg:grid-cols-2 lg:items-start"
	use:enhance={saveToast("Access settings")}
>
	<section class="glass rounded-2xl p-4 md:p-6">
		<h2 class="mb-4 font-semibold">Joining</h2>
		<div class="divide-border divide-y">
			<SettingSwitch
				name="signUpsEnabled"
				label="Open sign-ups"
				description={data.emailConfigured
					? "Anyone can create an account after confirming their email. Off means invite only."
					: "Needs email to be set up, to confirm addresses. Until then, it's invite only."}
				checked={data.signUpsEnabled}
				disabled={!data.emailConfigured}
			/>
		</div>
	</section>
	<section class="glass rounded-2xl p-4 md:p-6">
		<h2 class="mb-4 font-semibold">Sign-in security</h2>
		<div class="divide-border divide-y">
			<SettingSwitch
				name="requireTwoFactor"
				label="Require an authenticator app"
				description="Everyone must set up a 6-digit code app before using OpenCount, you included."
				checked={data.requireTwoFactor}
			/>
			<SettingSwitch
				name="requirePasskey"
				label="Require a passkey"
				description="Everyone must register at least one passkey before using OpenCount."
				checked={data.requirePasskey}
			/>
		</div>
	</section>
	<Button
		type="submit"
		class="h-11 justify-self-start rounded-xl px-5 lg:col-span-2"
	>
		<CheckIcon />
		Save
	</Button>
</form>
