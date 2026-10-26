<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import PowerOffIcon from "@lucide/svelte/icons/power-off";

	import CopyField from "#lib/components/copy-field.svelte";
	import { Badge } from "#lib/components/ui/badge/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { Textarea } from "#lib/components/ui/textarea/index.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	let errors = $state<Record<string, string[]>>({});
</script>

<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
	<form
		method="POST"
		action="?/save"
		class="glass flex min-w-0 flex-col gap-5 rounded-2xl p-4 md:p-6"
		use:enhance={enhanceToast({
			loading: "Checking the keys with Enable Banking",
			success: (result) =>
				`Bank sync is on, as ${String(result?.application)}.`,
			reset: true,
			onFailure: (result) =>
				(errors = (result?.errors as Record<string, string[]>) ?? {}),
			onSuccess: () => {
				errors = {};
			},
		})}
	>
		<div>
			<div class="flex items-center gap-2">
				<h2 class="font-semibold">Bank sync</h2>
				<Badge variant={data.applicationId ? "default" : "secondary"}
					>{data.applicationId ? "On" : "Off"}</Badge
				>
			</div>
			<p class="text-muted-foreground mt-1 text-sm">
				Lets people link their bank, Revolut included, so their card payments
				land in their personal expenses, ready to split in a group. It goes
				through Enable Banking, a licensed open-banking provider covering most
				banks in Europe.
			</p>
		</div>
		<ol
			class="text-muted-foreground flex list-decimal flex-col gap-1.5 pl-5 text-sm"
		>
			<li>
				Create an application in the Enable Banking control panel, production
				environment, with the redirect URL below. Keep the private key it
				generates.
			</li>
			<li>
				Free for personal use: link each person's own accounts to the
				application in the control panel first. A contract lifts that limit.
			</li>
			<li>Paste the application ID and the private key here.</li>
		</ol>
		<Field.Field>
			<Field.Label>Redirect URL</Field.Label>
			<CopyField value={data.redirectUrl} label="Copy the redirect URL" />
		</Field.Field>
		<Field.Field>
			<Field.Label for="bank-application">Application ID</Field.Label>
			<Input
				id="bank-application"
				name="applicationId"
				value={data.applicationId ?? ""}
				autocomplete="off"
				required
				class="h-11 font-mono"
			/>
			<Field.Error
				errors={errors.applicationId?.map((message) => ({ message }))}
			/>
		</Field.Field>
		<Field.Field>
			<Field.Label for="bank-key">Private key</Field.Label>
			<Textarea
				id="bank-key"
				name="privateKey"
				rows={5}
				required
				placeholder={data.applicationId
					? "Stored encrypted. Paste it again to change the keys."
					: "-----BEGIN PRIVATE KEY-----"}
				class="font-mono text-xs"
			/>
			<Field.Error
				errors={errors.privateKey?.map((message) => ({ message }))}
			/>
		</Field.Field>
		<Button type="submit" class="h-11 self-start rounded-xl px-5">
			<CheckIcon />
			Save and check
		</Button>
	</form>

	{#if data.applicationId}
		<form
			method="POST"
			action="?/remove"
			class="glass flex flex-col gap-3 rounded-2xl p-4 md:p-6"
			use:enhance={enhanceToast({
				loading: "Turning bank sync off",
				success: "Bank sync is off.",
			})}
		>
			<h2 class="font-semibold">Turn it off</h2>
			<p class="text-muted-foreground text-sm">
				Forgets the keys. Linked banks stop syncing; the expenses they brought
				stay.
			</p>
			<Button
				type="submit"
				variant="outline"
				class="h-11 self-start rounded-xl px-5"
			>
				<PowerOffIcon />
				Turn off
			</Button>
		</form>
	{/if}
</div>
