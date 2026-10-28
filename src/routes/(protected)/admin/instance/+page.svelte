<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";

	import SettingSwitch from "#lib/components/setting-switch.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Textarea } from "#lib/components/ui/textarea/index.js";
	import { saveToast } from "#lib/toast.js";

	const { data, form } = $props();
</script>

<form
	method="POST"
	class="grid gap-6 lg:grid-cols-2 lg:items-start"
	use:enhance={saveToast("Instance settings")}
>
	<section class="glass rounded-2xl p-4 md:p-6">
		<h2 class="mb-1 font-semibold">Banner</h2>
		<p class="text-muted-foreground mb-4 text-sm">
			Shown at the top of every page, sign-in included, to everyone: say it's a
			demo, or warn of maintenance. Leave it empty to show none.
		</p>
		<Field.Field data-invalid={form?.errors?.banner ? true : undefined}>
			<Field.Label for="instance-banner">Message</Field.Label>
			<Textarea
				id="instance-banner"
				name="banner"
				value={data.banner}
				maxlength={300}
				rows={3}
				placeholder="This is a demo: data resets every night."
				aria-invalid={form?.errors?.banner ? true : undefined}
			/>
			{#if form?.errors?.banner}
				<Field.Error>{form.errors.banner[0]}</Field.Error>
			{/if}
		</Field.Field>
	</section>
	<section class="glass rounded-2xl p-4 md:p-6">
		<h2 class="mb-4 font-semibold">Features</h2>
		<SettingSwitch
			name="bankSyncEnabled"
			label="Bank sync"
			description="People link their banks through their own Enable Banking keys and get their card payments in Personal every day. Off hides it, refuses new links and stops every sync; existing lines stay."
			checked={data.bankSyncEnabled}
		/>
	</section>
	<Button
		type="submit"
		class="h-11 rounded-xl px-5 lg:col-span-2 lg:justify-self-start"
	>
		<CheckIcon />
		Save
	</Button>
</form>
