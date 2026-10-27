<script lang="ts">
	import NavCards from "#lib/components/nav-cards.svelte";

	import { bankSyncTabs } from "./tabs.js";
</script>

<NavCards tabs={bankSyncTabs()} />
