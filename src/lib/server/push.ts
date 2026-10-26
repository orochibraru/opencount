import webpush from "web-push";

import { PushSubscriptionDTO } from "#lib/dto/push-subscription.js";
import { getSetting, setSetting } from "#lib/dto/setting.js";
import { getConfig } from "#lib/server/config.js";
import { decryptSecret, encryptSecret } from "#lib/server/secrets.js";

export interface PushNotification {
	title: string;
	body: string;
	url: string;
}

export type SendPush = (
	subscription: ReturnType<PushSubscriptionDTO["toWebPush"]>,
	payload: string,
	options: webpush.RequestOptions,
) => Promise<unknown>;

/** This server's VAPID public key, created with its private half the first time anything asks. */
export function vapidPublicKey(): string {
	const stored = getSetting("vapid");
	if (stored) {
		return stored.publicKey;
	}
	const keys = webpush.generateVAPIDKeys();
	setSetting("vapid", {
		publicKey: keys.publicKey,
		encryptedPrivateKey: encryptSecret(keys.privateKey),
	});
	return keys.publicKey;
}

function contact(): string {
	const origin = getConfig().origin;
	if (origin?.startsWith("https://")) {
		return origin;
	}
	const smtp = getSetting("smtp");
	return `mailto:${smtp?.fromAddress ?? "admin@opencount.invalid"}`;
}

/**
 * Sends `notification` to every device of `userIds` and forgets the ones the push service says are gone. Returns how
 * many devices got it.
 */
export async function deliverPush(
	userIds: string[],
	notification: PushNotification,
	send: SendPush = webpush.sendNotification,
): Promise<number> {
	const subscriptions = PushSubscriptionDTO.forUsers(userIds);
	if (subscriptions.length === 0) {
		return 0;
	}
	vapidPublicKey();
	const keys = getSetting("vapid");
	if (!keys) {
		return 0;
	}
	const options: webpush.RequestOptions = {
		TTL: 60 * 60 * 24,
		vapidDetails: {
			subject: contact(),
			publicKey: keys.publicKey,
			privateKey: decryptSecret(keys.encryptedPrivateKey),
		},
	};
	const payload = JSON.stringify(notification);
	let delivered = 0;
	for (const subscription of subscriptions) {
		try {
			await send(subscription.toWebPush(), payload, options);
			delivered += 1;
		} catch (error) {
			const status = (error as { statusCode?: number }).statusCode;
			if (status === 404 || status === 410) {
				PushSubscriptionDTO.removeEndpoint(subscription.endpoint);
			} else {
				throw error;
			}
		}
	}
	return delivered;
}
