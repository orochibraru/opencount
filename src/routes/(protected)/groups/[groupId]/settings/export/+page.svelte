<script lang="ts">
	import { enhance } from "$app/forms";
	import FileSpreadsheetIcon from "@lucide/svelte/icons/file-spreadsheet";
	import FileTextIcon from "@lucide/svelte/icons/file-text";

	import DownloadList from "#lib/components/download-list.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { enhanceToast } from "#lib/toast.js";

	const { data } = $props();

	const formats = [
		{
			action: "?/csv",
			icon: FileSpreadsheetIcon,
			title: "Spreadsheet (CSV)",
			description:
				"Every expense and payment with its date, category, payer and each person's share. Opens in Excel, Numbers or Sheets.",
		},
		{
			action: "?/pdf",
			icon: FileTextIcon,
			title: "Summary (PDF)",
			description:
				"Balances, who pays whom to settle up, then every expense. Ready to print or send.",
		},
	] as const;
</script>

<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
	<div class="flex flex-col gap-4">
		{#each formats as format (format.action)}
			<form
				method="POST"
				action={format.action}
				class="glass flex flex-col gap-3 rounded-2xl p-4 md:p-6"
				use:enhance={enhanceToast({
					loading: "Asking for the file",
					success: "Preparing it. It shows up below in a moment.",
				})}
			>
				<div class="flex items-start gap-3">
					<span
						class="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl"
					>
						<format.icon class="size-5" />
					</span>
					<div>
						<h2 class="font-semibold">{format.title}</h2>
						<p class="text-muted-foreground mt-1 text-sm">
							{format.description}
						</p>
					</div>
				</div>
				<Button type="submit" variant="secondary" class="h-11 rounded-xl">
					<format.icon />
					Export
				</Button>
			</form>
		{/each}
	</div>
	<DownloadList downloads={data.downloads} />
</div>
