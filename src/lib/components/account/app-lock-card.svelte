<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import LockIcon from "@lucide/svelte/icons/lock";
	import PowerOffIcon from "@lucide/svelte/icons/power-off";

	import Picker from "#lib/components/picker.svelte";
	import { Badge } from "#lib/components/ui/badge/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { enhanceToast } from "#lib/toast.js";

	interface Props {
		lock: { lockAfterMinutes: number } | null;
		removable: boolean;
		signedInRecently: boolean;
	}

	const { lock, removable, signedInRecently }: Props = $props();

	const delays = [
		{ value: "1", label: "After 1 minute away" },
		{ value: "5", label: "After 5 minutes away" },
		{ value: "15", label: "After 15 minutes away" },
		{ value: "60", label: "After 1 hour away" },
	];

	let errors = $state<Record<string, string[]>>({});
	let changing = $state(false);
	let formKey = $state(0);

	const fieldErrors = (name: string) =>
		errors[name]?.map((message) => ({ message }));

	const askCurrent = $derived(lock !== null && !signedInRecently);
</script>

{#snippet currentPasscodeField(id: string)}
	{#if askCurrent}
		<Field.Field>
			<Field.Label for={id}>Current passcode</Field.Label>
			<Input
				{id}
				name="currentPasscode"
				type="password"
				inputmode="numeric"
				autocomplete="off"
				maxlength={6}
				required
				class="h-11 font-mono tracking-widest"
			/>
			<Field.Error errors={fieldErrors("currentPasscode")} />
		</Field.Field>
	{/if}
{/snippet}

<section class="glass rounded-2xl p-4 md:p-6">
	<div class="flex items-start gap-3">
		<div
			class="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl"
		>
			<LockIcon class="size-5" />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h2 class="font-semibold">App lock</h2>
				<Badge variant={lock ? "default" : "secondary"}
					>{lock ? "On" : "Off"}</Badge
				>
			</div>
			<p class="text-muted-foreground mt-1 text-sm">
				A 6-digit passcode asked when you come back after a while, so someone
				picking up your phone sees nothing. Too many wrong tries sign you out.
			</p>
		</div>
	</div>

	{#if lock && !changing}
		<form
			method="POST"
			action="?/appLockDelay"
			class="mt-5 flex flex-col gap-3 md:flex-row md:items-end"
			use:enhance={enhanceToast({
				loading: "Saving",
				success: "App lock updated.",
			})}
		>
			<Field.Field class="md:w-64">
				<Field.Label for="lock-delay">Lock</Field.Label>
				<Picker
					id="lock-delay"
					name="lockAfterMinutes"
					label="Lock"
					options={delays}
					value={String(lock.lockAfterMinutes)}
				/>
			</Field.Field>
			<Button type="submit" class="h-11 rounded-xl px-5"
				><CheckIcon />Save</Button
			>
		</form>
		<div class="mt-3 flex flex-wrap gap-2">
			<Button
				variant="outline"
				class="h-11 rounded-xl px-5"
				onclick={() => (changing = true)}>Change passcode</Button
			>
		</div>
		{#if removable}
			<form
				method="POST"
				action="?/removeAppLock"
				class="mt-5 flex flex-col gap-3 md:flex-row md:items-end"
				use:enhance={enhanceToast({
					loading: "Turning it off",
					success: "App lock is off.",
					onFailure: (data) =>
						(errors = (data?.errors as Record<string, string[]>) ?? {}),
					onSuccess: () => {
						errors = {};
					},
				})}
			>
				{@render currentPasscodeField("remove-current-passcode")}
				<Button type="submit" variant="outline" class="h-11 rounded-xl px-5"
					><PowerOffIcon />Turn off</Button
				>
			</form>
		{/if}
	{:else}
		{#key formKey}
			<form
				method="POST"
				action="?/saveAppLock"
				class="mt-5 flex flex-col gap-4"
				use:enhance={enhanceToast({
					loading: "Saving your passcode",
					success: "App lock is on.",
					onFailure: (data) =>
						(errors = (data?.errors as Record<string, string[]>) ?? {}),
					onSuccess: () => {
						errors = {};
						changing = false;
						formKey += 1;
					},
				})}
			>
				{@render currentPasscodeField("current-passcode")}
				<div class="grid gap-4 md:grid-cols-2">
					<Field.Field>
						<Field.Label for="new-passcode">New passcode</Field.Label>
						<Input
							id="new-passcode"
							name="passcode"
							type="password"
							inputmode="numeric"
							autocomplete="off"
							maxlength={6}
							required
							class="h-11 font-mono tracking-widest"
						/>
						<Field.Error errors={fieldErrors("passcode")} />
					</Field.Field>
					<Field.Field>
						<Field.Label for="confirm-passcode">Type it again</Field.Label>
						<Input
							id="confirm-passcode"
							name="confirmPasscode"
							type="password"
							inputmode="numeric"
							autocomplete="off"
							maxlength={6}
							required
							class="h-11 font-mono tracking-widest"
						/>
						<Field.Error errors={fieldErrors("confirmPasscode")} />
					</Field.Field>
				</div>
				<Field.Field class="md:w-64">
					<Field.Label for="new-lock-delay">Lock</Field.Label>
					<Picker
						id="new-lock-delay"
						name="lockAfterMinutes"
						label="Lock"
						options={delays}
						value={String(lock?.lockAfterMinutes ?? 5)}
					/>
					<Field.Error errors={fieldErrors("lockAfterMinutes")} />
				</Field.Field>
				<div class="flex flex-wrap gap-2">
					<Button type="submit" class="h-11 rounded-xl px-5"
						><CheckIcon />{lock ? "Change passcode" : "Turn on"}</Button
					>
					{#if changing}
						<Button
							variant="ghost"
							class="h-11 rounded-xl px-5"
							onclick={() => {
								changing = false;
								errors = {};
							}}>Cancel</Button
						>
					{/if}
				</div>
			</form>
		{/key}
	{/if}
</section>
