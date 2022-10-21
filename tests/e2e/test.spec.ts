// import { chromium, Browser, Page } from "playwright";
import { test, expect, PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  use: {
    channel: "chrome",
  },
};
export default config;

// test('homepage has Playwright in title and get started link linking to the intro page', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Expect a title "to contain" a substring.
//   await expect(page).toHaveTitle(/Playwright/);

//   // create a locator
//   const getStarted = page.getByText('Get Started');

//   // Expect an attribute "to be strictly equal" to the value.
//   await expect(getStarted).toHaveAttribute('href', '/docs/intro');

//   // Click the get started link.
//   await getStarted.click();

//   // Expects the URL to contain intro.
//   await expect(page).toHaveURL(/.*intro/);
// });

test.describe("My First E2E test", () => {
  test("title text", async ({ page }) => {
    await expect(page).toHaveScreenshot("1.png");
    // await expect(
    //   // page.locator("css=.v-navigation-drawer >> css=.v-list-item-title")
    //   page.locator("#inspire > div > nav > div > a > div > div > div")
    // ).toHaveText("War-on-Board");

    await page.getByLabel("the layer of tiles").fill("6");
    await page.getByRole("button", { name: "Change" }).click();
    await expect(page).toHaveScreenshot("2.png");

    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page).toHaveScreenshot("3.png");

    await page.locator(".hexagon-panel").first().click();
    await expect(page).toHaveScreenshot("4.png");

    await page
      .locator("div:nth-child(3) > div > .hexagon-panel")
      .first()
      .click();
    await expect(page).toHaveScreenshot("5.png");

    await page
      .locator("div:nth-child(3) > div > .hexagon-panel")
      .first()
      .click();
    await expect(page).toHaveScreenshot("6.png");

    await page.locator(".hexagon-panel").first().click();
    await expect(page).toHaveScreenshot("7.png");
  });
});

// describe("My First Test", () => {
//   it("Visits the app root url", () => {
//     cy.visit("/");
//     cy.get(".v-navigation-drawer").contains(
//       ".v-list-item-title",
//       "War-on-Board"
//     );
//     cy.get(".v-toolbar").find(".mdi-menu").click();

//     cy.get("#app").find("#layer").should("have.value", 5);
//     cy.get(".layered-hexagon-panels > .horizontal-layer").should(
//       "have.length",
//       5 * 2 - 1
//     );

//     cy.get("#app").find("#layer").type("{backspace}6");
//     cy.get("#app").find("#layer").should("have.value", 6);

//     cy.get("#app").contains("button", "Change").click();
//     cy.get(".layered-hexagon-panels > .horizontal-layer").should(
//       "have.length",
//       6 * 2 - 1
//     );

//     cy.contains("button", "Generate").click();

//     cy.get(
//       "#inspire > div > main > div > div > div > div > div:nth-child(2) > div > div"
//     ).as("panel-1-1");
//     cy.get(
//       "#inspire > div > main > div > div > div > div > div:nth-child(3) > div:nth-child(1) > div"
//     ).as("panel-2-1");
//     cy.get(
//       "#inspire > div > main > div > div > div > div > div:nth-child(4) > div:nth-child(1) > div"
//     ).as("panel-3-1");

//     cy.get("@panel-1-1").should("have.class", "occupied");
//     cy.get("@panel-2-1").should("have.class", "unoccupied");
//     cy.get("@panel-3-1").should("have.class", "unoccupied");

//     cy.get("@panel-1-1").click();
//     cy.get("@panel-1-1").should("have.class", "selected");
//     cy.get("@panel-2-1").should("have.class", "movable");
//     cy.get("@panel-3-1").should("have.class", "immovable");

//     cy.get("@panel-2-1").click();
//     cy.get("@panel-1-1").should("have.class", "unoccupied");
//     cy.get("@panel-2-1").should("have.class", "occupied");
//     cy.get("@panel-3-1").should("have.class", "unoccupied");

//     cy.get("@panel-2-1").click();
//     cy.get("@panel-1-1").should("have.class", "movable");
//     cy.get("@panel-2-1").should("have.class", "selected");
//     cy.get("@panel-3-1").should("have.class", "movable");

//     cy.get("@panel-1-1").click();
//     cy.get("@panel-1-1").should("have.class", "occupied");
//     cy.get("@panel-2-1").should("have.class", "unoccupied");
//     cy.get("@panel-3-1").should("have.class", "unoccupied");
//   });
// });
