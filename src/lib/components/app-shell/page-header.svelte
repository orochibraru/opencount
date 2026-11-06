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
			<DropdownMenu.Content align="end" class="min-w-52">
				{#each secondary as action (action.label)}
					{#if action.href}
						<DropdownMenu.Item>
							{#snippet child({ props })}
								<a {...props} href={action.href}>
									<action.icon />
									{action.label}
								</a>
							{/snippet}
						</DropdownMenu.Item>
					{:else}
						<DropdownMenu.Item onSelect={action.onSelect}>
							<action.icon />
							{action.label}
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
