<script lang="ts">
	import NavCards from "#lib/components/nav-cards.svelte";

	import { bankSyncTabs } from "./tabs.js";

	const { data } = $props();
</script>

<NavCards tabs={bankSyncTabs(data.bankSyncOn)} />
