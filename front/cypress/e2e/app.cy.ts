/**
 * General app smoke tests.
 * These verify that the app boots, routes are reachable, and key UI elements render.
 */

// ── Search page — référence vs texte ──────────────────────────────────────────
describe('SearchPage — référence vs texte', () => {
  /**
   * Régression : "Jean 1:1" était traité comme une recherche texte sur "jean"
   * et retournait ~170 résultats (1 Maccabées, etc.) au lieu du seul verset Jn 1:1.
   */
  it('Jean 1:1 → colonne refs contient exactement Jn 1:1, pas 170 résultats', () => {
    cy.visit('/search?q=Jean%201%3A1');
    // Attendre la fin du chargement
    cy.contains(/\d+ référence/i, { timeout: 10000 }).should('exist');
    // Exactement 1 référence (le verset Jean 1:1)
    cy.contains(/^1 référence$/i).should('exist');
    // Le label de la référence doit être Jean 1:1
    cy.contains('Jean 1:1').should('exist');
  });

  it('Jean 1:1 → colonne versets vide (pas de recherche texte déclenchée)', () => {
    cy.visit('/search?q=Jean%201%3A1');
    cy.contains(/\d+ verset/i, { timeout: 10000 }).should('exist');
    cy.contains(/^0 verset$/i).should('exist');
  });

  it('recherche texte "amour" → colonne versets non vide, colonne refs vide', () => {
    cy.visit('/search?q=amour');
    cy.contains(/\d+ verset/i, { timeout: 10000 }).should('exist');
    // Au moins un résultat texte — le compteur ne doit pas être "0 verset"
    cy.contains(/^0 verset$/i).should('not.exist');
    // Aucune référence détectée
    cy.contains('Aucune référence détectée.').should('exist');
  });

  it('référence chapitre entier Jean 1 → groupe Jean 1 présent', () => {
    cy.visit('/search?q=Jean%201');
    cy.contains(/\d+ référence/i, { timeout: 10000 }).should('exist');
    cy.contains(/^0 référence$/i).should('not.exist');
    // Titre du groupe = "Jean 1"
    cy.contains('Jean 1').should('exist');
  });
});

describe('App bootstrap', () => {
  it('loads the home page without errors', () => {
    cy.visit('/');
    cy.get('body').should('exist');
    // No uncaught exceptions
  });

  it('navigates to the graph page', () => {
    cy.visit('/graph');
    // The graph page shows a loading spinner while fetching structure, then renders
    cy.get('canvas', { timeout: 10000 }).should('exist');
  });

  it('navigates to the search page', () => {
    cy.visit('/search');
    cy.url().should('include', '/search');
  });

  it('sidebar links are present', () => {
    cy.visit('/');
    cy.get('nav, aside').should('exist');
  });

  it('shows no JavaScript errors on boot', () => {
    cy.on('uncaught:exception', (err) => {
      // Fail test on uncaught error
      throw err;
    });
    cy.visit('/');
  });
});
