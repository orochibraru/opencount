<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";

	import CopyField from "#lib/components/copy-field.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Badge } from "#lib/components/ui/badge/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { Textarea } from "#lib/components/ui/textarea/index.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	const enableBankingApplications = "https://enablebanking.com/cp/applications";

	let errors = $state<Record<string, string[]>>({});
	let tutorialOpen = $state(false);
</script>

<div class="grid gap-6">
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
				Brings your card payments, Revolut included, into your personal expenses
				every day. It goes through your own Enable Banking application, free for
				personal use, so only you and your bank see the data.
			</p>
		</div>
		<Button
			href={enableBankingApplications}
			target="_blank"
			rel="noopener noreferrer"
			variant="secondary"
			class="h-11 self-start rounded-xl px-5"
			onclick={() => (tutorialOpen = true)}
		>
			<ExternalLinkIcon />
			Create an app on Enable Banking
		</Button>
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
</div>

<ResponsiveSheet
	bind:open={tutorialOpen}
	title="Create your Enable Banking app"
	description="Enable Banking opened in a new tab. Follow along there, then come back here with the key."
>
	<div class="flex flex-col gap-5 pb-4">
		<ol class="flex list-decimal flex-col gap-4 pl-5 text-sm">
			<li>
				<span class="font-medium">Sign in.</span>
				<span class="text-muted-foreground"
					>Type your email: Enable Banking sends a one-time link, and the
					account is made on the first sign-in. The link brings you back to its
					control panel.</span
				>
			</li>
			<li>
				<span class="font-medium">Fill "Add a new application".</span>
				<span class="text-muted-foreground"
					>Pick Production, keep the default private key option, and name it
					OpenCount: your bank shows that name when you confirm. Paste this as
					the redirect URL:</span
				>
				<div class="mt-2">
					<CopyField value={data.redirectUrl} label="Copy the redirect URL" />
				</div>
			</li>
			<li>
				<span class="font-medium">Press Register.</span>
				<span class="text-muted-foreground"
					>Your browser downloads the private key, a .pem file named after the
					application ID.</span
				>
			</li>
			<li>
				<span class="font-medium">Link your own accounts.</span>
				<span class="text-muted-foreground"
					>Free personal use only reaches the accounts you link to the
					application in its control panel, so link every bank you want here.</span
				>
			</li>
			<li>
				<span class="font-medium">Paste both here.</span>
				<span class="text-muted-foreground"
					>The application ID is the .pem file's name without .pem. Open the
					file and paste all of it as the private key, from -----BEGIN to the
					END line.</span
				>
			</li>
		</ol>
		<div class="flex flex-col gap-2 sm:flex-row">
			<Button
				href={enableBankingApplications}
				target="_blank"
				rel="noopener noreferrer"
				variant="secondary"
				class="h-11 rounded-xl sm:flex-1"
			>
				<ExternalLinkIcon />
				Open Enable Banking again
			</Button>
			<Button
				class="h-11 rounded-xl sm:flex-1"
				onclick={() => (tutorialOpen = false)}
			>
				<CheckIcon />
				I have my key
			</Button>
		</div>
	</div>
</ResponsiveSheet>
