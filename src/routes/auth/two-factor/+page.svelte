<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";

	import AuthShell from "#lib/components/auth-shell.svelte";
	import AuthForm from "#lib/components/auth/auth-form.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Checkbox } from "#lib/components/ui/checkbox/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { keepRedirect } from "#lib/keep-redirect.js";

	let errors = $state<Record<string, string[]>>({});
	let useBackupCode = $state(false);
</script>

<AuthShell
	heading="Two-step check"
	subheading={useBackupCode
		? "Enter one of your backup codes."
		: "Enter the 6-digit code from your authenticator app."}
>
	{#if useBackupCode}
		<AuthForm
			action={keepRedirect("?/backup", page.url)}
			submitLabel="Verify"
			submitIcon={ShieldCheckIcon}
			loading="Checking"
			success="Signed in."
			bind:errors
		>
			<Field.Field>
				<Field.Label for="backup-code">Backup code</Field.Label>
				<Input
					id="backup-code"
					name="code"
					autocomplete="one-time-code"
					required
					class="h-11 font-mono"
				/>
				<Field.Error errors={errors.code?.map((message) => ({ message }))} />
			</Field.Field>
		</AuthForm>
	{:else}
		<AuthForm
			action={keepRedirect("?/totp", page.url)}
			submitLabel="Verify"
			submitIcon={ShieldCheckIcon}
			loading="Checking"
			success="Signed in."
			bind:errors
		>
			<Field.Field>
				<Field.Label for="totp">Code</Field.Label>
				<Input
					id="totp"
					name="code"
					inputmode="numeric"
					autocomplete="one-time-code"
					maxlength={6}
					required
					class="h-14 text-center font-mono text-2xl tracking-[0.5em]"
				/>
				<Field.Error errors={errors.code?.map((message) => ({ message }))} />
			</Field.Field>
			<Field.Field orientation="horizontal">
				<Checkbox id="trust-device" name="trustDevice" value="true" />
				<Field.Label for="trust-device" class="font-normal"
					>Trust this device for 30 days</Field.Label
				>
			</Field.Field>
		</AuthForm>
	{/if}
	<Button
		variant="link"
		class="mt-4 w-full"
		onclick={() => (useBackupCode = !useBackupCode)}
	>
		{useBackupCode
			? "Use the authenticator app"
			: "Lost your device? Use a backup code"}
	</Button>
	{#snippet footer()}
		<a href={resolve("/auth/sign-in")} class="text-primary font-medium"
			>Back to sign in</a
		>
	{/snippet}
</AuthShell>
