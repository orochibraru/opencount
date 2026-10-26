<script lang="ts">
	import { cn } from "#lib/utils.js";

	const { class: className }: { class?: string } = $props();
</script>

<svg class={cn("size-8", className)} viewBox="0 0 512 512" aria-hidden="true">
	<rect width="512" height="512" rx="112" class="fill-primary" />
	<circle
		cx="208"
		cy="256"
		r="104"
		fill="none"
		class="stroke-primary-foreground"
		stroke-width="44"
	/>
	<circle
		cx="304"
		cy="256"
		r="104"
		fill="none"
		class="stroke-primary-foreground"
		stroke-opacity="0.55"
		stroke-width="44"
	/>
</svg>
