<script lang="ts">
	import { enhance } from "$app/forms";
	import { page } from "$app/state";
	import LockOpenIcon from "@lucide/svelte/icons/lock-open";

	import AuthShell from "#lib/components/auth-shell.svelte";
	import AuthForm from "#lib/components/auth/auth-form.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { clearCachedPages } from "#lib/offline-cache.js";
	import { keepRedirect } from "#lib/redirect-target.js";

	const { data } = $props();

	let errors = $state<Record<string, string[]>>({});
</script>

<AuthShell
	heading="OpenCount is locked"
	subheading={data.name
		? `Enter your passcode to continue as ${data.name}.`
		: "Enter your passcode to continue."}
>
	<AuthForm
		action={keepRedirect("?/unlock", page.url)}
		submitLabel="Unlock"
		submitIcon={LockOpenIcon}
		loading="Checking"
		success="Unlocked."
		bind:errors
	>
		<Field.Field>
			<Field.Label for="passcode">Passcode</Field.Label>
			<Input
				id="passcode"
				name="passcode"
				type="password"
				inputmode="numeric"
				autocomplete="off"
				maxlength={6}
				required
				class="h-14 text-center font-mono text-2xl tracking-[0.5em]"
			/>
			<Field.Error errors={errors.passcode?.map((message) => ({ message }))} />
		</Field.Field>
	</AuthForm>
	<form
		method="POST"
		action="?/signOut"
		class="mt-4"
		use:enhance={clearCachedPages}
	>
		<Button type="submit" variant="link" class="h-11 w-full">
			Forgot it? Sign out and sign in again
		</Button>
	</form>
	{#snippet footer()}
		{data.email}
	{/snippet}
</AuthShell>
