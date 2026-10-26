import { $ } from "bun";

const baseIndex = process.argv.indexOf("--base");
const base = baseIndex === -1 ? undefined : process.argv[baseIndex + 1];

const range = base ? [`${base}...HEAD`] : ["--cached"];
const changed = (
	await $`git diff --name-only --diff-filter=MDR ${range} -- drizzle/`.text()
)
	.split("\n")
	.filter(
		(path) =>
			path.endsWith(".sql") || /^drizzle\/meta\/\d+_snapshot\.json$/.test(path),
	);

if (changed.length > 0) {
	console.error(
		`Committed migrations are append-only, but these were edited, renamed or deleted:\n${changed.map((path) => `  ${path}`).join("\n")}\n` +
			"Restore them and add the change as a new migration with `bun run db:generate`.",
	);
	process.exit(1);
}
