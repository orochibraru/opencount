<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";

	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { saveToast } from "#lib/toast.js";

	const { data } = $props();
</script>

<form
	method="POST"
	action="?/profile"
	class="glass flex max-w-3xl flex-col gap-5 rounded-2xl p-4 md:p-6"
	use:enhance={saveToast("Profile")}
>
	<Field.Field>
		<Field.Label for="profile-name">Name</Field.Label>
		<Input
			id="profile-name"
			name="name"
			value={data.user.name}
			autocomplete="name"
			required
			maxlength={80}
			class="h-11"
		/>
	</Field.Field>
	<Field.Field>
		<Field.Label for="profile-email">Email</Field.Label>
		<Input id="profile-email" value={data.user.email} disabled class="h-11" />
		<Field.Description>Ask an admin to change it.</Field.Description>
	</Field.Field>
	<Button type="submit" class="h-11 self-start rounded-xl px-5">
		<CheckIcon />
		Save
	</Button>
</form>
