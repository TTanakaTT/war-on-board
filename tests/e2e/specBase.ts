import {
  test,
  expect,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestInfo,
} from "@playwright/test";
import type { Page } from "playwright-core";

export class SpecBase {
  title!: string;
  page!: Page;
  constructor(title?: string) {
    if (title) {
      this.title = title;
    }
  }
  runTest(
    testFunction: (
      args: PlaywrightTestArgs &
        PlaywrightTestOptions &
        PlaywrightWorkerArgs &
        PlaywrightWorkerOptions,
      testInfo: TestInfo
    ) => void
  ): void {
    test.beforeEach(async ({ page }) => {
      await page.goto("http://localhost:8080/war-on-board/");
    });

    test(this.title, testFunction);
  }
  async compareScreenshot(page: Page, screenshotName: string): Promise<void> {
    await expect(page).toHaveScreenshot(
      this.title ? this.title + "-" + screenshotName : screenshotName
    );
  }
}
