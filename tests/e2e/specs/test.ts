// https://docs.cypress.io/api/introduction/api.html

describe("My First Test", () => {
  it("Visits the app root url", () => {
    cy.visit("/");
    cy.get(".v-navigation-drawer").contains(
      ".v-list-item-title",
      "War-on-Board"
    );
    cy.get(".v-toolbar").find(".mdi-menu").click();

    cy.get("#app").find("#layer").should("have.value", 5);
    cy.get(".layered-hexagon-panels > .horizontal-layer").should(
      "have.length",
      5 * 2 - 1
    );

    cy.get("#app").find("#layer").type("{backspace}6");
    cy.get("#app").find("#layer").should("have.value", 6);

    cy.get("#app").contains("button", "Change").click();
    cy.get(".layered-hexagon-panels > .horizontal-layer").should(
      "have.length",
      6 * 2 - 1
    );

    cy.contains("button", "Generate").click();

    cy.get(
      "#inspire > div > main > div > div > div > div > div:nth-child(2) > div > div"
    ).as("panel-1-1");
    cy.get(
      "#inspire > div > main > div > div > div > div > div:nth-child(3) > div:nth-child(1) > div"
    ).as("panel-2-1");
    cy.get(
      "#inspire > div > main > div > div > div > div > div:nth-child(4) > div:nth-child(1) > div"
    ).as("panel-3-1");

    cy.get("@panel-1-1").should("have.class", "occupied");
    cy.get("@panel-2-1").should("have.class", "unoccupied");
    cy.get("@panel-3-1").should("have.class", "unoccupied");

    cy.get("@panel-1-1").click();
    cy.get("@panel-1-1").should("have.class", "selected");
    cy.get("@panel-2-1").should("have.class", "movable");
    cy.get("@panel-3-1").should("have.class", "immovable");

    cy.get("@panel-2-1").click();
    cy.get("@panel-1-1").should("have.class", "unoccupied");
    cy.get("@panel-2-1").should("have.class", "occupied");
    cy.get("@panel-3-1").should("have.class", "unoccupied");

    cy.get("@panel-2-1").click();
    cy.get("@panel-1-1").should("have.class", "movable");
    cy.get("@panel-2-1").should("have.class", "selected");
    cy.get("@panel-3-1").should("have.class", "movable");

    cy.get("@panel-1-1").click();
    cy.get("@panel-1-1").should("have.class", "occupied");
    cy.get("@panel-2-1").should("have.class", "unoccupied");
    cy.get("@panel-3-1").should("have.class", "unoccupied");
  });
});
