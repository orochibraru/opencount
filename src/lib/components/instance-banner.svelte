<script lang="ts">
	import { page } from "$app/state";
	import MegaphoneIcon from "@lucide/svelte/icons/megaphone";
</script>

{#if page.data.banner}
	<p
		role="status"
		class="bg-accent text-accent-foreground mb-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
	>
		<MegaphoneIcon class="mt-0.5 size-4 shrink-0" />
		<span class="min-w-0 whitespace-pre-line">{page.data.banner}</span>
	</p>
{/if}
