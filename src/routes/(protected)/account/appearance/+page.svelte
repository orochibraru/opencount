<script lang="ts">
	import { enhance } from "$app/forms";
	import { untrack } from "svelte";

	import { applyAppearance } from "#lib/appearance.js";
	import { enhanceToast } from "#lib/toast.js";

	import OptionGroup from "./option-group.svelte";

	const { data } = $props();

	const accents = [
		{ value: "bordeaux", label: "Bordeaux", hue: "oklch(0.44 0.15 8)" },
		{ value: "green", label: "Green", hue: "oklch(0.6 0.14 165)" },
		{ value: "blue", label: "Blue", hue: "oklch(0.6 0.19 255)" },
		{ value: "violet", label: "Violet", hue: "oklch(0.6 0.2 293)" },
		{ value: "rose", label: "Rose", hue: "oklch(0.6 0.2 12)" },
		{ value: "orange", label: "Orange", hue: "oklch(0.66 0.18 48)" },
		{ value: "amber", label: "Amber", hue: "oklch(0.76 0.16 78)" },
		{ value: "cyan", label: "Cyan", hue: "oklch(0.65 0.13 210)" },
		{ value: "neutral", label: "Neutral", hue: "oklch(0.3 0 0)" },
	] as const;

	const themes = [
		{ value: "system", label: "System" },
		{ value: "light", label: "Light" },
		{ value: "dark", label: "Dark" },
	] as const;

	const darkVariants = [
		{ value: "default", label: "Dim" },
		{ value: "amoled", label: "AMOLED black" },
	] as const;

	const fonts = [
		{ value: "default", label: "Geist and Sora" },
		{ value: "system", label: "System" },
		{ value: "serif", label: "Serif" },
		{ value: "mono", label: "Mono" },
	] as const;

	const cornerStyles = [
		{ value: "rounded", label: "Rounded" },
		{ value: "square", label: "Square" },
	] as const;

	let form: HTMLFormElement | undefined = $state();
	let current = $state(untrack(() => ({ ...data.appearance })));

	function preview() {
		applyAppearance(
			document.documentElement,
			current,
			matchMedia("(prefers-color-scheme: dark)").matches,
		);
		form?.requestSubmit();
	}
</script>

<form
	method="POST"
	bind:this={form}
	class="flex flex-col gap-7"
	use:enhance={enhanceToast({
		loading: "Saving appearance",
		success: "Appearance saved.",
		reset: false,
	})}
>
	<OptionGroup
		name="accent"
		legend="Accent"
		options={accents}
		bind:value={current.accent}
		onchange={preview}
	>
		{#snippet swatch(option)}
			<span
				class="size-4 rounded-full"
				style="background: {accents.find(
					(accent) => accent.value === option.value,
				)?.hue}"
				aria-hidden="true"
			></span>
		{/snippet}
	</OptionGroup>
	<OptionGroup
		name="theme"
		legend="Theme"
		options={themes}
		bind:value={current.theme}
		onchange={preview}
	/>
	<OptionGroup
		name="darkVariant"
		legend="Dark mode"
		options={darkVariants}
		bind:value={current.darkVariant}
		onchange={preview}
	/>
	<OptionGroup
		name="font"
		legend="Font"
		options={fonts}
		bind:value={current.font}
		onchange={preview}
	/>
	<OptionGroup
		name="corners"
		legend="Corners"
		options={cornerStyles}
		bind:value={current.corners}
		onchange={preview}
	/>
</form>
