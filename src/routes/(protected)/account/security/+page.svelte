<script lang="ts">
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";

	import * as Alert from "#lib/components/ui/alert/index.js";

	import PasskeysCard from "./passkeys-card.svelte";
	import TwoFactorCard from "./two-factor-card.svelte";

	const { data } = $props();

	const labels = {
		"two-factor": "an authenticator app",
		passkey: "a passkey",
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
	<TwoFactorCard enabled={data.twoFactorEnabled} />
	<PasskeysCard passkeys={data.passkeys} />
</div>
