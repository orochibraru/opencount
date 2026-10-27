<script lang="ts">
	import { resolve } from "$app/paths";

	import TabSection from "#lib/components/tab-section.svelte";

	import { bankSyncTabs } from "./tabs.js";

	const { children } = $props();
</script>

<TabSection
	title="Bank sync"
	indexHref={resolve("/(protected)/account/banks")}
	backHref={resolve("/(protected)/account")}
	tabs={bankSyncTabs()}
>
	{@render children()}
</TabSection>
