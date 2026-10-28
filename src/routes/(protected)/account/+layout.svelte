<script lang="ts">
	import { resolve } from "$app/paths";

	import TabSection from "#lib/components/tab-section.svelte";

	import { accountTabs } from "./tabs.js";

	const { children, data } = $props();
</script>

<TabSection
	title="Account"
	indexHref={resolve("/(protected)/account")}
	tabs={accountTabs(data.bankSyncEnabled)}
>
	{@render children()}
</TabSection>
