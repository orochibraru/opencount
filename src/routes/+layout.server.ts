import { AppearanceDTO, defaultAppearance } from "#lib/dto/appearance.js";
import { getConfig } from "#lib/server/config.js";

export const load = ({ locals }) => ({
	version: getConfig().appVersion,
	appearance: locals.user
		? AppearanceDTO.forUser(locals.user.id).toJSON()
		: defaultAppearance,
});
