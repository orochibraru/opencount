<script lang="ts">
	import {
		type DateValue,
		getLocalTimeZone,
		parseDate,
		today,
	} from "@internationalized/date";
	import CalendarIcon from "@lucide/svelte/icons/calendar";
	import { MediaQuery } from "svelte/reactivity";

	import { Button } from "#lib/components/ui/button/index.js";
	import { Calendar } from "#lib/components/ui/calendar/index.js";
	import * as Drawer from "#lib/components/ui/drawer/index.js";
	import * as Popover from "#lib/components/ui/popover/index.js";
	import { cn } from "#lib/utils.js";

	interface Props {
		id: string;
		name: string;
		label: string;
		value: string;
	}

	let { id, name, label, value = $bindable() }: Props = $props();

	const desktop = new MediaQuery("(min-width: 768px)");
	const nested = Drawer.isInsideDrawer();
	const locale =
		typeof navigator === "undefined" ? "en-US" : navigator.language;

	let open = $state(false);

	const selected = $derived(value ? parseDate(value) : undefined);
	const todayValue = $derived(today(getLocalTimeZone()));
	const shortcuts = $derived([
		{ label: "Today", date: todayValue },
		{ label: "Yesterday", date: todayValue.subtract({ days: 1 }) },
	]);
	const display = $derived(
		value
			? new Date(`${value}T12:00:00`).toLocaleDateString(locale, {
					weekday: "short",
					day: "numeric",
					month: "long",
					year: "numeric",
				})
			: "Pick a date",
	);

	function choose(next: DateValue | undefined) {
		if (next) {
			value = next.toString();
			open = false;
		}
	}
</script>

<input type="hidden" {name} {value} />

{#snippet picker(touch: boolean)}
	<div class={cn("flex gap-2", touch ? "px-4 pb-1" : "px-3 pt-3")}>
		{#each shortcuts as shortcut (shortcut.label)}
			<Button
				variant={selected?.compare(shortcut.date) === 0 ? "default" : "outline"}
				size="sm"
				class={cn("rounded-full", touch && "h-10 flex-1 text-sm")}
				onclick={() => choose(shortcut.date)}
			>
				{shortcut.label}
			</Button>
		{/each}
	</div>
	<Calendar
		type="single"
		value={selected}
		onValueChange={choose}
		{locale}
		weekdayFormat="short"
		class={cn(
			"mx-auto bg-transparent",
			touch && "[--cell-size:--spacing(11)] text-base",
		)}
	/>
{/snippet}

{#snippet trigger(props: Record<string, unknown>)}
	<button
		{...props}
		type="button"
		{id}
		class="border-input bg-background focus-visible:ring-ring/50 flex h-11 w-full items-center gap-2 rounded-md border px-3 text-left text-sm outline-none focus-visible:ring-3"
	>
		<CalendarIcon class="text-muted-foreground size-4 shrink-0" />
		<span class="min-w-0 flex-1 truncate">{display}</span>
	</button>
{/snippet}

{#if desktop.current}
	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				{@render trigger(props)}
			{/snippet}
		</Popover.Trigger>
		<Popover.Content align="start" class="w-auto rounded-xl p-0">
			{@render picker(false)}
		</Popover.Content>
	</Popover.Root>
{:else}
	{@render trigger({ onclick: () => (open = true), "aria-haspopup": "dialog" })}
	{#snippet drawerContent()}
		<Drawer.Content>
			<Drawer.Header class="px-5 text-left">
				<Drawer.Title>{label}</Drawer.Title>
			</Drawer.Header>
			{@render picker(true)}
		</Drawer.Content>
	{/snippet}
	{#if nested}
		<Drawer.NestedRoot bind:open>{@render drawerContent()}</Drawer.NestedRoot>
	{:else}
		<Drawer.Root bind:open>{@render drawerContent()}</Drawer.Root>
	{/if}
{/if}
