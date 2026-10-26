<script lang="ts">
	import type { Snippet } from "svelte";

	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		name: string;
		legend: string;
		options: readonly Option[];
		value: string;
		onchange: () => void;
		swatch?: Snippet<[Option]>;
	}

	let {
		name,
		legend,
		options,
		value = $bindable(),
		onchange,
		swatch,
	}: Props = $props();
</script>

<fieldset>
	<legend class="mb-2 px-1 text-sm font-medium">{legend}</legend>
	<div class="flex flex-wrap gap-2">
		{#each options as option (option.value)}
			<label
				class="border-border bg-card has-checked:border-primary has-checked:ring-primary/30 has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-all has-checked:ring-2 has-focus-visible:ring-3"
			>
				<input
					type="radio"
					{name}
					value={option.value}
					bind:group={value}
					{onchange}
					class="sr-only"
				/>
				{#if swatch}
					{@render swatch(option)}
				{/if}
				{option.label}
			</label>
		{/each}
	</div>
</fieldset>
