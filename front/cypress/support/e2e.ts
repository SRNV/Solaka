// Global Cypress support file — loaded before every spec.
// Add custom commands or global hooks here.

// Wait for the backend health check so tests don't run against a loading screen.
Cypress.Commands.add('waitForApp', () => {
  cy.get('[data-testid="app-ready"]', { timeout: 15000 }).should('exist');
});

export {};
