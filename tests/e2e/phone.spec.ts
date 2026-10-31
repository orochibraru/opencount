import { expect, test } from "@playwright/test";

test("adding an expense with the drawers on a phone", async ({ page }) => {
	await page.addInitScript(() =>
		localStorage.setItem("opencount-install-prompted", "e2e"),
	);
	await page.goto("/");
	await page.getByRole("button", { name: "New group" }).last().click();
	await page.getByRole("dialog").getByLabel("Name").fill("Ski weekend");
	await page.getByRole("button", { name: "Create group" }).click();
	await expect(page).toHaveURL(/\/settings\/members/);

	await page.goto("/");
	await page.getByRole("link", { name: /Ski weekend/ }).click();
	await page.getByRole("button", { name: "Add expense" }).last().click();
	const sheet = page.getByRole("dialog").last();
	await sheet.locator("input[name=amount]").fill("18");
	await sheet.getByLabel("What for").fill("Lift passes");

	await sheet.locator("#expense-category").click();
	const picker = page.getByRole("dialog").last();
	await picker.getByPlaceholder("Search categories").fill("trans");
	await picker.getByRole("option", { name: "Transport" }).click();
	await expect(page.locator("#expense-category")).toContainText("Transport");

	await page.locator("#expense-date").click();
	await page
		.getByRole("dialog")
		.last()
		.getByRole("button", { name: "Yesterday" })
		.click();

	await page.getByRole("button", { name: "Add expense" }).last().click();
	await expect(page.getByText("Expense added.")).toBeVisible();
	await expect(page.getByText("Lift passes")).toBeVisible();

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth,
	);
	expect(overflow).toBeLessThanOrEqual(0);
});

test("the app links an installable manifest", async ({ page, request }) => {
	await page.goto("/");
	const href = await page.locator('link[rel="manifest"]').getAttribute("href");
	expect(href).toBeTruthy();
	const manifest = await request.get(new URL(href ?? "", page.url()).href);
	expect(manifest.ok()).toBe(true);
	const body = await manifest.json();
	expect(body.display).toBe("standalone");
	expect(
		body.icons.some((icon: { sizes: string }) => icon.sizes === "512x512"),
	).toBe(true);
});

test("a phone is offered the install once", async ({ page }) => {
	await page.goto("/");
	const prompt = page.getByRole("dialog", { name: "Install OpenCount" });
	await expect(prompt).toBeVisible({ timeout: 10_000 });
	await prompt.getByRole("button", { name: /Got it|Not now/ }).click();
	await expect(prompt).toBeHidden();
	expect(
		await page.evaluate(() =>
			localStorage.getItem("opencount-install-prompted"),
		),
	).not.toBeNull();
});

test("a visited page boots from the cache, then refreshes once the server answers", async ({
	context,
	page,
}) => {
	await page.addInitScript(() =>
		localStorage.setItem("opencount-install-prompted", "e2e"),
	);
	await page.goto("/");
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	await expect(page.locator("#boot-splash")).toHaveCount(0);

	const refreshed = page.waitForRequest((request) =>
		request.url().includes("__data.json"),
	);
	await page.reload();
	await refreshed;
	await expect(page.locator("#boot-splash")).toHaveCount(0);

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole("link", { name: /Ski weekend/ })).toBeVisible();
	await expect(page.locator("#boot-splash")).toHaveCount(0);
	await expect(page.locator("html")).not.toHaveAttribute("data-boot-cache");
	await page.waitForTimeout(1500);
	expect(new URL(page.url()).pathname).toBe("/");
	await context.setOffline(false);
});
