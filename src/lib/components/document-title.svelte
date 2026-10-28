<script lang="ts">
	import { usePageTitle } from "#lib/page-title.svelte.js";

	const title = usePageTitle();
	const text = $derived(
		!title.current
			? "OpenCount"
			: title.current.includes("OpenCount")
				? title.current
				: `${title.current} · OpenCount`,
	);
</script>

<svelte:head>
	<title>{text}</title>
</svelte:head>
