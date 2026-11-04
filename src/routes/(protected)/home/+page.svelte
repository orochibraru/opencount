<script lang="ts">
	import { resolve } from "$app/paths";
	import WalletIcon from "@lucide/svelte/icons/wallet";

	import LeftUntilPayday from "#lib/components/home/left-until-payday.svelte";
	import MoneyOverview from "#lib/components/home/money-overview.svelte";
	import { setPageTitle } from "#lib/page-title.svelte.js";

	const { data } = $props();

	setPageTitle("Home", undefined, [
		{
			label: "Personal",
			icon: WalletIcon,
			href: resolve("/(protected)/personal"),
		},
	]);
</script>

{#if data.left}
	<div class="mb-4 md:mb-6">
		<LeftUntilPayday parts={data.left.parts} included={data.left.included} />
	</div>
{/if}
<MoneyOverview overview={data.overview} />
