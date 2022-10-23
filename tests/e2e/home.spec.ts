import { SpecBase } from "./specBase";

const base = new SpecBase("home");

base.runTest(async ({ page }) => {
  await base.compareScreenshot(page, "0-0.png");

  await page.locator("header.v-toolbar > div > button").click();
  await base.compareScreenshot(page, "1-1.png");
  await page.locator("header.v-toolbar > div > button").click();
  await base.compareScreenshot(page, "1-2.png");

  await page.getByLabel("the layer of tiles").fill("6");
  await page.getByRole("button", { name: "Change" }).click();
  await base.compareScreenshot(page, "2-1.png");

  await page.getByRole("button", { name: "Generate" }).click();
  await base.compareScreenshot(page, "2-2.png");

  await page.locator(".hexagon-panel").first().click();
  await base.compareScreenshot(page, "3-1.png");

  await page.locator("div:nth-child(3) > div > .hexagon-panel").first().click();
  await base.compareScreenshot(page, "3-2.png");

  await page.locator("div:nth-child(3) > div > .hexagon-panel").first().click();
  await base.compareScreenshot(page, "3-3.png");

  await page.locator(".hexagon-panel").first().click();
  await base.compareScreenshot(page, "3-4.png");
});
