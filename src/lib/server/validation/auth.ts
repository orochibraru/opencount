import { z } from "zod";

import { passwordMaxLength, passwordRules } from "#lib/password-policy.js";

export const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email("Enter a valid email."));

export const signInSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, "Enter your password.").max(passwordMaxLength),
});

export const signUpStartSchema = z.object({ email: emailSchema });

export const codeSchema = z.object({
	code: z
		.string()
		.trim()
		.regex(/^\d{3}[- ]?\d{3}$/, "Enter the 6-digit code.")
		.transform((code) => code.replace(/[- ]/, "")),
});

/** Name, password and its confirmation for a new account whose address is `email`. */
export function newAccountSchema(email: string) {
	return z
		.object({
			name: z
				.string()
				.trim()
				.min(1, "Enter your name.")
				.max(80, "Keep it under 80 characters."),
			password: z.string(),
			confirmPassword: z.string(),
		})
		.superRefine((value, context) => {
			for (const rule of passwordRules(value.password, email)) {
				if (!rule.passed) {
					context.addIssue({
						code: "custom",
						path: ["password"],
						message: `${rule.label}.`,
					});
				}
			}
			if (value.password !== value.confirmPassword) {
				context.addIssue({
					code: "custom",
					path: ["confirmPassword"],
					message: "The passwords don't match.",
				});
			}
		});
}

export const totpSchema = z.object({
	code: z
		.string()
		.trim()
		.regex(/^\d{6}$/, "Enter the 6-digit code from your app."),
	trustDevice: z.stringbool().optional(),
});

export const backupCodeSchema = z.object({
	code: z.string().trim().min(1, "Enter a backup code."),
});

export const passwordConfirmSchema = z.object({
	password: z.string().min(1, "Enter your password.").max(passwordMaxLength),
});

export const emailSignInSchema = z.object({ email: emailSchema });

export const emailCodeSignInSchema = z.object({
	email: emailSchema,
	code: codeSchema.shape.code,
});
