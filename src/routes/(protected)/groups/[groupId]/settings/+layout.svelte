<script lang="ts">
	import { resolve } from "$app/paths";

	import TabSection from "#lib/components/tab-section.svelte";

	import { groupSettingsTabs } from "./tabs.js";

	const { children, data } = $props();
</script>

<TabSection
	title="Settings"
	indexHref={resolve("/(protected)/groups/[groupId]/settings", {
		groupId: data.group.id,
	})}
	backHref={resolve("/(protected)/groups/[groupId]", {
		groupId: data.group.id,
	})}
	tabs={groupSettingsTabs(data.group.id)}
>
	{@render children()}
</TabSection>
