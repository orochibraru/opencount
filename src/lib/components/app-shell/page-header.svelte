<script lang="ts">
	import { resolve } from "$app/paths";
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import EllipsisIcon from "@lucide/svelte/icons/ellipsis";

	import IconButton from "#lib/components/icon-button.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
	import { usePageTitle } from "#lib/page-title.svelte.js";

	const title = usePageTitle();
	const secondary = $derived(title.actions.filter((action) => !action.primary));
	const primary = $derived(title.actions.filter((action) => action.primary));
	const folded = $derived(secondary.length > 2);
</script>

<header class="mb-6 hidden min-h-10 items-center gap-3 md:flex">
	{#if title.backHref && title.backHref !== resolve("/(protected)") && title.backHref !== resolve("/(protected)/groups")}
		<IconButton
			label="Back"
			icon={ChevronLeftIcon}
			href={title.backHref}
			variant="outline"
		/>
	{/if}
	<h1
		class="font-display min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight"
	>
		{title.current}
	</h1>
	{#if folded}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<IconButton
						{...props}
						label="More options"
						icon={EllipsisIcon}
						variant="outline"
					/>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-80 p-1.5">
				{#each secondary as action (action.label)}
					{#snippet body()}
						<span
							class="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
						>
							<action.icon class="size-4" />
						</span>
						<span class="flex min-w-0 flex-col">
							<span class="font-medium">{action.label}</span>
							{#if action.description}
								<span class="text-muted-foreground text-xs leading-snug"
									>{action.description}</span
								>
							{/if}
						</span>
					{/snippet}
					{#if action.href}
						<DropdownMenu.Item class="items-start gap-3 rounded-lg px-2 py-2">
							{#snippet child({ props })}
								<a {...props} href={action.href}>{@render body()}</a>
							{/snippet}
						</DropdownMenu.Item>
					{:else}
						<DropdownMenu.Item
							class="items-start gap-3 rounded-lg px-2 py-2"
							onSelect={action.onSelect}
						>
							{@render body()}
						</DropdownMenu.Item>
					{/if}
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
	{#each folded ? primary : title.actions as action (action.label)}
		<Button
			href={action.href}
			onclick={action.onSelect}
			variant={action.primary ? "default" : "outline"}
			class="h-10 rounded-xl px-4 {action.primary ? 'glow' : ''}"
		>
			<action.icon />
			{action.label}
		</Button>
	{/each}
</header>
