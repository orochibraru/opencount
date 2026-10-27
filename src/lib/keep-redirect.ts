/** Form action `action` with the page's `redirectTo` carried along, so signing in lands where the person was headed. */
export function keepRedirect(
	action: string,
	url: { searchParams: { get(name: string): string | null } },
): string {
	const target = url.searchParams.get("redirectTo");
	return target ? `${action}&redirectTo=${encodeURIComponent(target)}` : action;
}
