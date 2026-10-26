<script lang="ts">
	import { enhance } from "$app/forms";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import FingerprintIcon from "@lucide/svelte/icons/fingerprint";
	import KeySquareIcon from "@lucide/svelte/icons/key-square";
	import LogInIcon from "@lucide/svelte/icons/log-in";
	import { toast } from "svelte-sonner";

	import { authClient } from "#lib/auth-client.js";
	import AuthShell from "#lib/components/auth-shell.svelte";
	import AuthForm from "#lib/components/auth/auth-form.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { enhanceToast, toastError } from "#lib/toast.js";

	const { data } = $props();

	let errors = $state<Record<string, string[]>>({});
	let passkeyPending = $state(false);

	async function passkeySignInCallback() {
		passkeyPending = true;
		try {
			const result = await authClient.signIn.passkey();
			if (result?.error) {
				throw new Error(result.error.message ?? "That passkey didn't work.");
			}
			const target = page.url.searchParams.get("redirectTo");
			await goto(
				target?.startsWith("/") && !target.startsWith("//")
					? target
					: resolve("/(protected)"),
				{ invalidateAll: true },
			);
		} finally {
			passkeyPending = false;
		}
	}

	function handlePasskeySignIn() {
		toast.promise(passkeySignInCallback(), {
			loading: "Waiting for your passkey",
			success: "Signed in.",
			error: (error: unknown) => toastError(error, "That passkey didn't work."),
		});
	}

	const alternatives = $derived(
		data.methods.passkey || data.methods.sso.length > 0,
	);
</script>

<AuthShell heading="Welcome back" subheading="Sign in to see who owes what.">
	{#if data.methods.password}
		<AuthForm
			action="?/password"
			submitLabel="Sign in"
			submitIcon={LogInIcon}
			loading="Signing in"
			success="Signed in."
			bind:errors
		>
			<Field.Field>
				<Field.Label for="email">Email</Field.Label>
				<Input
					id="email"
					name="email"
					type="email"
					autocomplete="username webauthn"
					inputmode="email"
					required
					class="h-11"
				/>
				<Field.Error errors={errors.email?.map((message) => ({ message }))} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="password">Password</Field.Label>
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class="h-11"
				/>
				<Field.Error
					errors={errors.password?.map((message) => ({ message }))}
				/>
			</Field.Field>
		</AuthForm>
		{#if alternatives}
			<div class="text-muted-foreground my-5 flex items-center gap-3 text-xs">
				<span class="bg-border h-px flex-1"></span>
				or
				<span class="bg-border h-px flex-1"></span>
			</div>
		{/if}
	{/if}

	<div class="flex flex-col gap-3">
		{#if data.methods.passkey}
			<Button
				variant={data.methods.password ? "outline" : "default"}
				size="lg"
				class="h-12 w-full rounded-xl text-base {data.methods.password
					? ''
					: 'glow'}"
				onclick={handlePasskeySignIn}
				disabled={passkeyPending}
			>
				<FingerprintIcon />
				Sign in with a passkey
			</Button>
		{/if}
		{#each data.methods.sso as provider (provider.id)}
			<form
				method="POST"
				action="?/sso"
				use:enhance={enhanceToast({
					loading: `Opening ${provider.name}`,
					success: `Redirecting to ${provider.name}.`,
				})}
			>
				<input type="hidden" name="provider" value={provider.id} />
				<Button
					type="submit"
					variant="outline"
					size="lg"
					class="h-12 w-full rounded-xl text-base"
				>
					<KeySquareIcon />
					Continue with {provider.name}
				</Button>
			</form>
		{/each}
	</div>

	{#snippet footer()}
		{#if data.signUpsOpen}
			New here? <a
				href={resolve("/auth/sign-up")}
				class="text-primary font-medium">Create an account</a
			>
		{:else}
			This server is invite only. Ask an admin for an invite.
		{/if}
	{/snippet}
</AuthShell>
