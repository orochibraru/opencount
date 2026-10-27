<script lang="ts">
	import { resolve } from "$app/paths";
	import WalletIcon from "@lucide/svelte/icons/wallet";

	import { setPageTitle } from "#lib/page-title.svelte.js";

	import MoneyOverview from "./money-overview.svelte";

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
