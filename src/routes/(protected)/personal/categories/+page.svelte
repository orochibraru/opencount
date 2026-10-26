<script lang="ts">
	import { resolve } from "$app/paths";

	import CategoryManager from "#lib/components/category-manager.svelte";
	import { setPageTitle } from "#lib/page-title.svelte.js";

	const { data } = $props();

	setPageTitle("Categories", resolve("/(protected)/personal"));
</script>

<CategoryManager
	custom={data.categories}
	usage={data.usage}
	ownHeading="Your own"
	sortDescription="Files every expense still under Other by its description, how you filed the same one before and your own categories, and marks savings and investing as set aside. Ones you filed yourself stay where they are."
/>
