<script lang="ts">
	import ScaleIcon from "@lucide/svelte/icons/scale";

	import { Button } from "#lib/components/ui/button/index.js";
	import { formatMoney } from "#lib/money.js";

	interface Props {
		balanceMinor: number;
		totalSpentMinor: number;
		currency: string;
		memberCount: number;
		balancesHref: string;
	}

	const {
		balanceMinor,
		totalSpentMinor,
		currency,
		memberCount,
		balancesHref,
	}: Props = $props();

	const tone = $derived(
		balanceMinor > 0 ? "owed" : balanceMinor < 0 ? "owes" : "even",
	);
</script>

<section
	class="glass relative overflow-hidden rounded-3xl p-5 md:p-6"
	aria-label="Your balance"
>
	<div
		class="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full opacity-60 blur-3xl {tone ===
		'owes'
			? 'bg-negative/40'
			: 'bg-primary/40'}"
		aria-hidden="true"
	></div>
	<p class="text-muted-foreground relative text-sm">
		{tone === "owed"
			? "You're owed"
			: tone === "owes"
				? "You owe"
				: "You're settled up"}
	</p>
	<p
		class="font-display relative mt-1 text-5xl font-semibold tracking-tight tabular {tone ===
		'owed'
			? 'text-positive'
			: tone === 'owes'
				? 'text-negative'
				: ''}"
	>
		{formatMoney(Math.abs(balanceMinor), currency)}
	</p>
	<div class="text-muted-foreground relative mt-5 flex items-end gap-6 text-sm">
		<p>
			<span class="text-foreground block font-medium tabular"
				>{formatMoney(totalSpentMinor, currency)}</span
			>
			spent together
		</p>
		<p>
			<span class="text-foreground block font-medium tabular"
				>{memberCount}</span
			>
			{memberCount === 1 ? "person" : "people"}
		</p>
		<Button
			href={balancesHref}
			variant="secondary"
			class="ml-auto h-10 rounded-xl px-4"
		>
			<ScaleIcon />
			{balanceMinor === 0 ? "Balances" : "Settle up"}
		</Button>
	</div>
</section>
