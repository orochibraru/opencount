import type { Handle } from "@sveltejs/kit/hooks";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const formTypes = new Set([
	"application/x-www-form-urlencoded",
	"multipart/form-data",
	"text/plain",
	"application/x-sveltekit-formdata",
]);

/**
 * Builds SvelteKit's cross-site form check, also accepting `publicOrigin`: with no proxy header adapter-bun assumes https,
 * so on a plain-HTTP instance `event.url` never matches what the browser sends.
 */
export function csrfHandler(publicOrigin: () => string | undefined): Handle {
	return ({ event, resolve }) => {
		const { headers, method } = event.request;
		const type = headers
			.get("content-type")
			?.split(";")[0]
			?.trim()
			.toLowerCase();
		const origin = headers.get("origin");
		if (
			mutatingMethods.has(method) &&
			(!type || formTypes.has(type)) &&
			origin !== event.url.origin &&
			origin !== publicOrigin()
		) {
			return Response.json(
				{ message: `Cross-site ${method} form submissions are forbidden` },
				{ status: 403 },
			);
		}
		return resolve(event);
	};
}
