import adapter from "@sveltejs/adapter-bun";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
				experimental: { async: true },
			},
			adapter: adapter({
				buildOptions: { compile: true },
				serverOptions: { maxRequestBodySize: 32 * 1024 * 1024 },
			}),
			experimental: { remoteFunctions: true },
			csrf: { trustedOrigins: ["*"] },
			csp: {
				directives: {
					"frame-ancestors": ["none"],
					"object-src": ["none"],
					"base-uri": ["self"],
				},
			},
			tracing: { server: true },
		}),
	],
	build: {
		target: "es2022",
		cssMinify: true,
		reportCompressedSize: false,
	},
});
