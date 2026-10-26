<script lang="ts">
	import CategoryManager from "#lib/components/category-manager.svelte";

	const { data } = $props();
</script>

<CategoryManager
	custom={data.categories}
	usage={data.usage}
	ownHeading="This group's"
	sortDescription="Files every expense still under Other by its description, its merchant and this group's own categories. Ones you filed yourself stay where they are."
/>
