<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";

	interface Bank {
		id: string;
		bankName: string;
		bankLogo: string | null;
		failed: boolean;
		syncing: boolean;
	}

	interface Props {
		banks: Bank[];
		active: string | null;
		href: (bankId: string | null) => string;
	}

	const { banks, active, href }: Props = $props();

	const anySyncing = $derived(banks.some((bank) => bank.syncing));

	$effect(() => {
		if (!anySyncing) {
			return;
		}
		const timer = setInterval(() => void invalidateAll(), 3000);
		return () => clearInterval(timer);
	});
</script>

<nav aria-label="Banks" class="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
	<ul class="flex w-max gap-2">
		{#each banks as bank (bank.id)}
			{@const selected = active === bank.id}
			<li>
				<a
					href={href(selected ? null : bank.id)}
					data-sveltekit-reset="false"
					aria-current={selected ? "true" : undefined}
					title={bank.failed
						? `${bank.bankName}: the last sync failed`
						: bank.syncing
							? `${bank.bankName}: syncing`
							: bank.bankName}
					class="glass aria-current:bg-primary aria-current:text-primary-foreground flex h-11 items-center gap-2 rounded-full pr-4 pl-1.5 text-sm font-medium transition-colors"
				>
					<span
						class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full {bank.bankLogo
							? 'bg-white'
							: 'bg-accent text-accent-foreground'}"
					>
						{#if bank.bankLogo}
							<img
								src={bank.bankLogo}
								alt=""
								class="size-6 object-contain"
								loading="lazy"
							/>
						{:else}
							<LandmarkIcon class="size-4" />
						{/if}
					</span>
					{bank.bankName}
					{#if bank.syncing}
						<LoaderCircleIcon class="size-4 animate-spin" aria-hidden="true" />
					{:else if bank.failed}
						<span class="bg-destructive size-2 rounded-full" aria-hidden="true"
						></span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
