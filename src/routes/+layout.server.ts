import { AppearanceDTO, defaultAppearance } from "#lib/dto/appearance.js";
import { getSetting } from "#lib/dto/setting.js";
import { configuration } from "#lib/server/core/config.js";

export const load = ({ locals }) => ({
	version: configuration.get().appVersion,
	banner: getSetting("banner"),
	appearance: locals.user
		? AppearanceDTO.forUser(locals.user.id).toJSON()
		: defaultAppearance,
});
