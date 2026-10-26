<script lang="ts">
	import { enhance } from "$app/forms";
	import DatabaseBackupIcon from "@lucide/svelte/icons/database-backup";
	import UploadIcon from "@lucide/svelte/icons/upload";
	import XIcon from "@lucide/svelte/icons/x";

	import DownloadList from "#lib/components/download-list.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	let confirmOpen = $state(false);
	let restoreForm: HTMLFormElement | undefined = $state();
	let picked = $state(false);
</script>

<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
	<div class="flex flex-col gap-6">
		<form
			method="POST"
			action="?/backup"
			class="glass flex flex-col gap-3 rounded-2xl p-4 md:p-6"
			use:enhance={enhanceToast({
				loading: "Asking for a backup",
				success: "Preparing it. It shows up in a moment.",
			})}
		>
			<h2 class="text-lg font-semibold">Back up</h2>
			<p class="text-muted-foreground text-sm">
				A copy of the whole SQLite database: accounts, groups, expenses and
				settings. Stored secrets stay encrypted with this server's AUTH_SECRET,
				so keep that too.
			</p>
			<Button
				type="submit"
				variant="secondary"
				class="h-11 self-start rounded-xl"
			>
				<DatabaseBackupIcon />
				Make a backup
			</Button>
		</form>

		<form
			method="POST"
			action="?/restore"
			enctype="multipart/form-data"
			class="glass flex flex-col gap-4 rounded-2xl p-4 md:p-6"
			bind:this={restoreForm}
			use:enhance={enhanceToast({
				loading: "Restoring the backup",
				success: "Restored. Sign in again.",
				onSettled: () => (confirmOpen = false),
			})}
		>
			<div>
				<h2 class="text-lg font-semibold">Restore</h2>
				<p class="text-muted-foreground mt-1 text-sm">
					Replaces everything on this server with the backup. Everyone, you
					included, signs in again with the accounts it holds.
				</p>
			</div>
			<Field.Field>
				<Field.Label for="backup-file">Backup file</Field.Label>
				<Input
					id="backup-file"
					name="backup"
					type="file"
					accept=".sqlite,.db,application/vnd.sqlite3"
					required
					onchange={(event) =>
						(picked = event.currentTarget.files?.length === 1)}
					class="h-11 pt-2.5"
				/>
			</Field.Field>
			<Button
				variant="destructive"
				class="h-11 self-start rounded-xl"
				disabled={!picked}
				onclick={() => (confirmOpen = true)}
			>
				<UploadIcon />
				Restore
			</Button>
		</form>
	</div>
	<DownloadList downloads={data.downloads} />
</div>

<ResponsiveSheet
	bind:open={confirmOpen}
	title="Replace everything with this backup?"
	description="Accounts, groups and expenses made since it was taken are lost."
>
	<div class="flex flex-col-reverse gap-2 pb-4 md:flex-row md:justify-end">
		<Button
			variant="outline"
			class="h-11 rounded-xl"
			onclick={() => (confirmOpen = false)}><XIcon />Cancel</Button
		>
		<Button
			variant="destructive"
			class="h-11 rounded-xl"
			onclick={() => restoreForm?.requestSubmit()}
		>
			<UploadIcon />
			Restore
		</Button>
	</div>
</ResponsiveSheet>
