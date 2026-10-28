<script lang="ts">
	import { resolve } from "$app/paths";
	import WalletIcon from "@lucide/svelte/icons/wallet";

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

<MoneyOverview overview={data.overview} />
