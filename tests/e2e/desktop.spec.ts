import { expect, test } from "@playwright/test";

test("a group from creation to insights and back from the archive", async ({
	page,
}) => {
	await page.goto("/");
	await page.getByRole("button", { name: "New group" }).first().click();
	await page.getByRole("dialog").getByLabel("Name").fill("Lisbon trip");
	await page.getByRole("button", { name: "Create group" }).click();
	await expect(page).toHaveURL(/\/settings\/members/);

	await page.getByRole("link", { name: "Lisbon trip" }).click();
	await page.getByRole("button", { name: "Add expense" }).first().click();
	const sheet = page.getByRole("dialog");
	await sheet.locator("input[name=amount]").fill("42.50");
	await sheet.getByLabel("What for").fill("Dinner at the harbour");
	await expect(sheet.getByText("Picked from the name")).toBeVisible();
	await expect(sheet.locator("#expense-category")).toContainText(
		"Food & drinks",
	);
	await sheet.getByRole("button", { name: "Add expense" }).click();
	await expect(page.getByText("Expense added.")).toBeVisible();
	await expect(page.getByText("Dinner at the harbour")).toBeVisible();

	await page.getByRole("link", { name: "Insights" }).click();
	await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
	await expect(page.getByText("€42.50").first()).toBeVisible();

	await page.goBack();
	await page.getByRole("link", { name: "Settings" }).click();
	await expect(page).toHaveURL(/\/settings\/general/);
	await expect(page.getByRole("link", { name: "Categories" })).toBeVisible();
	await page.getByRole("button", { name: "Archive group" }).click();
	await expect(page.getByText("Archived.")).toBeVisible();

	await page.goto("/archived");
	await expect(page.getByText("Lisbon trip")).toBeVisible();
	await page.goto("/");
	await expect(page.getByText("Lisbon trip")).toHaveCount(0);
});
