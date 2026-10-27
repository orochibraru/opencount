<script lang="ts">
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";

	import * as Alert from "#lib/components/ui/alert/index.js";

	import AppLockCard from "./app-lock-card.svelte";
	import PasskeysCard from "./passkeys-card.svelte";
	import PasswordCard from "./password-card.svelte";
	import SessionsCard from "./sessions-card.svelte";
	import TwoFactorCard from "./two-factor-card.svelte";

	const { data } = $props();

	const labels = {
		"two-factor": "an authenticator app",
		passkey: "a passkey",
		"app-lock": "an app lock",
	} as const;
</script>

<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
	{#if data.missing.length > 0}
		<Alert.Root class="lg:col-span-2">
			<TriangleAlertIcon />
			<Alert.Title>Your admin requires more security</Alert.Title>
			<Alert.Description>
				Set up {data.missing.map((factor) => labels[factor]).join(" and ")} to keep
				using OpenCount.
			</Alert.Description>
		</Alert.Root>
	{/if}
	<PasswordCard email={data.user.email} hasPassword={data.hasPassword} />
	<TwoFactorCard enabled={data.twoFactorEnabled} />
	<PasskeysCard passkeys={data.passkeys} />
	<AppLockCard
		lock={data.appLock}
		removable={data.appLockRemovable}
		signedInRecently={data.signedInRecently}
	/>
	<SessionsCard sessions={data.sessions} currentId={data.currentSessionId} />
</div>
