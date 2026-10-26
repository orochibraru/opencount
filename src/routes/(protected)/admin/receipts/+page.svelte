<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import PowerIcon from "@lucide/svelte/icons/power";
	import PowerOffIcon from "@lucide/svelte/icons/power-off";
	import ScanTextIcon from "@lucide/svelte/icons/scan-text";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import { untrack } from "svelte";

	import Picker from "#lib/components/picker.svelte";
	import * as Alert from "#lib/components/ui/alert/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { type ReceiptReading, receiptTypes } from "#lib/receipts.js";
	import { tesseractLanguageName } from "#lib/tesseract-languages.js";
	import { enhanceToast, saveToast } from "#lib/toast.js";

	const { data } = $props();

	const languageOptions = $derived(
		data.availableLanguages
			.map((code) => ({ value: code, label: tesseractLanguageName(code) }))
			.toSorted((left, right) => left.label.localeCompare(right.label)),
	);
	let reading = $state<ReceiptReading | null>(null);
	let languages = $state(untrack(() => data.ocr?.languages ?? ["eng"]));

	function money(minor: number | null, currency: string | null): string {
		if (minor === null) {
			return "?";
		}
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: currency ?? "EUR",
		}).format(minor / 100);
	}
</script>

<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
	{#if !data.installed}
		<Alert.Root>
			<TriangleAlertIcon />
			<Alert.Title>Tesseract isn't installed on this server</Alert.Title>
			<Alert.Description>
				The Docker image ships it. Running from source, run <code
					>mise install</code
				>
				in the repository, or install it yourself (<code
					>brew install tesseract tesseract-lang</code
				>, <code>apt install tesseract-ocr</code>), then restart the server.
			</Alert.Description>
		</Alert.Root>
	{:else}
		<form
			method="POST"
			action="?/save"
			class="glass flex flex-col gap-5 rounded-2xl p-4 md:p-6"
			use:enhance={saveToast("Receipt reading")}
		>
			<div>
				<h2 class="font-semibold">Receipt reading</h2>
				<p class="text-muted-foreground mt-1 text-sm">
					Optional. Photos are read on this server by Tesseract, in the
					background worker. Nothing leaves the machine. Pick the languages your
					receipts are printed in: fewer is faster and more accurate.
				</p>
			</div>
			<Field.Field>
				<Field.Label for="ocr-languages">Languages</Field.Label>
				<Picker
					id="ocr-languages"
					name="languages"
					label="Languages"
					options={languageOptions}
					bind:values={languages}
					multiple
					placeholder="Pick the languages"
					search={{
						placeholder: "Search languages",
						empty: "No language with that name.",
					}}
				/>
			</Field.Field>
			<Button type="submit" class="h-11 self-start rounded-xl px-5"
				>{#if data.ocr}<CheckIcon />{:else}<PowerIcon />{/if}{data.ocr
					? "Save"
					: "Turn on"}</Button
			>
		</form>
	{/if}

	{#if data.ocr}
		<section class="glass flex flex-col gap-4 rounded-2xl p-4 md:p-6">
			<div>
				<h2 class="font-semibold">Try a receipt</h2>
				<p class="text-muted-foreground mt-1 text-sm">
					A flat, well-lit photo reads best, and a PDF with text is read
					exactly. Nothing is kept: the file is read, then dropped.
				</p>
			</div>
			{#if !data.pdfReadable}
				<p class="text-muted-foreground text-sm">
					PDFs need Poppler, which isn't installed here. The Docker image ships
					it.
				</p>
			{/if}
			<form
				method="POST"
				action="?/scan"
				enctype="multipart/form-data"
				class="flex flex-col gap-3 md:flex-row md:items-center"
				use:enhance={enhanceToast({
					loading: "Reading the receipt",
					success: "Receipt read.",
					reset: true,
					onSuccess: (result) => {
						reading = (result?.reading as ReceiptReading | undefined) ?? null;
					},
				})}
			>
				<Input
					name="receipt"
					type="file"
					accept={receiptTypes.join(",")}
					required
					class="h-11 flex-1 py-2"
				/>
				<Button type="submit" class="h-11 rounded-xl px-5"
					><ScanTextIcon />Read it</Button
				>
			</form>
			{#if reading}
				<dl class="grid grid-cols-2 gap-3 rounded-xl border p-3 text-sm">
					<div>
						<dt class="text-muted-foreground">Merchant</dt>
						<dd class="font-medium">{reading.merchant ?? "Not found"}</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Total</dt>
						<dd class="font-medium tabular">
							{money(reading.totalMinor, reading.currency)}
						</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Date</dt>
						<dd class="font-medium">{reading.date ?? "Not found"}</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Lines</dt>
						<dd class="font-medium tabular">{reading.items.length}</dd>
					</div>
					<details class="text-muted-foreground col-span-2 text-xs">
						<summary class="cursor-pointer">Recognized text</summary>
						<pre
							class="bg-muted mt-1 max-h-48 overflow-auto rounded-lg p-2 whitespace-pre-wrap">{reading.text}</pre>
					</details>
				</dl>
			{/if}
		</section>
		<form
			method="POST"
			action="?/remove"
			use:enhance={saveToast("Receipt reading")}
		>
			<Button type="submit" variant="destructive" class="h-11 rounded-xl px-5"
				><PowerOffIcon />Turn off receipt reading</Button
			>
		</form>
	{/if}
</div>
