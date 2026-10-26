<script lang="ts">
	import NavCards from "#lib/components/nav-cards.svelte";

	import { groupSettingsTabs } from "./tabs.js";

	const { data } = $props();
</script>

<NavCards tabs={groupSettingsTabs(data.group.id)} />
