import type { Session } from "#lib/server/auth.js";
import type { SessionGate } from "#lib/server/security-policy.js";

declare global {
	namespace App {
		interface Error {
			message: string;
			errorId?: string;
		}
		interface Locals {
			session: Session["session"] | null;
			user: Session["user"] | null;
			gate: SessionGate | null;
		}
	}
}
