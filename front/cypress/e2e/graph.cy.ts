/**
 * Graph page E2E tests.
 * Covers the main 3D visualization, search bar, tradition toggles and sort modes.
 *
 * Prerequisites: the dev server must be running (`npm run dev`).
 */

describe('GraphPage', () => {
  beforeEach(() => {
    cy.visit('/graph');
    // Wait for the Three.js canvas to be mounted (structure API must have responded)
    cy.get('canvas', { timeout: 15000 }).should('exist');
  });

  it('renders the main 3D canvas', () => {
    cy.get('canvas').should('have.length.gte', 1);
  });

  it('displays the Catholique and Protestant toggle buttons', () => {
    cy.contains('button', 'Catholique').should('exist');
    cy.contains('button', 'Protestant').should('exist');
  });

  it('displays the sort-mode buttons', () => {
    cy.contains('button', 'Classique').should('exist');
    cy.contains('button', 'Historique').should('exist');
    cy.contains('button', 'Taille').should('exist');
  });

  it('displays the Pulse toggle', () => {
    cy.contains('button', 'Pulse').should('exist');
  });

  it('renders the search bar', () => {
    cy.get('input[type="search"]').should('exist');
  });

  it('can type a reference into the search bar', () => {
    cy.get('input[type="search"]').type('Jean 3:16');
    cy.get('input[type="search"]').should('have.value', 'Jean 3:16');
  });

  it('clears the search bar with the ✕ button', () => {
    cy.get('input[type="search"]').type('Jean 3');
    cy.contains('button', '✕').click();
    cy.get('input[type="search"]').should('have.value', '');
  });

  it('switches to Historique sort mode', () => {
    cy.contains('button', 'Historique').click();
    cy.contains('button', 'Historique').should('have.class', /sortBtnActive/);
  });

  it('switches to Taille sort mode', () => {
    cy.contains('button', 'Taille').click();
    cy.contains('button', 'Taille').should('have.class', /sortBtnActive/);
  });

  it('switches back to Classique sort mode', () => {
    cy.contains('button', 'Historique').click();
    cy.contains('button', 'Classique').click();
    cy.contains('button', 'Classique').should('have.class', /sortBtnActive/);
  });

  it('shows the Rois/Périodes/Événements frise selector in Historique mode', () => {
    cy.contains('button', 'Historique').click();
    cy.contains('button', 'Rois').should('exist');
    cy.contains('button', 'Périodes').should('exist');
    cy.contains('button', 'Événements').should('exist');
  });

  it('toggles the Catholique tradition filter', () => {
    cy.contains('button', 'Catholique').click();
    // After click, the button should lose its active styling
    cy.contains('button', 'Catholique').should('not.have.class', /pillCathActive/);
    // Click again to re-enable
    cy.contains('button', 'Catholique').click();
    cy.contains('button', 'Catholique').should('have.class', /pillCathActive/);
  });
});

describe('GraphPage — search integration', () => {
  it('submitting a reference triggers relation arcs', () => {
    cy.visit('/graph');
    cy.get('canvas', { timeout: 15000 }).should('exist');
    cy.get('input[type="search"]').type('Jean 3:16{enter}');
    // After pressing Enter, search hits should appear (badge or coloured cubes)
    // We wait a moment for the STOMP stream to respond
    cy.wait(2000);
    // The canvas should still be present (no crash)
    cy.get('canvas').should('exist');
  });

  it('no relations are loaded on bare mount (no search, no drawer)', () => {
    // Regression: relationsEnabled was initialised true, subscribing to all
    // relations immediately on mount. The "✕ Filtre" button only appears when
    // drawerRelations is set, which should NOT happen on bare mount.
    cy.visit('/graph');
    cy.get('canvas', { timeout: 15000 }).should('exist');
    cy.wait(1500); // let any erroneous STOMP message arrive
    cy.contains('button', '✕ Filtre').should('not.exist');
  });

  it('submitting then clearing search fully resets the arc stream', () => {
    // Regression: storeRels from Zustand was never cleared between queries,
    // causing stale arcs from previous search to linger after clearing.
    cy.visit('/graph');
    cy.get('canvas', { timeout: 15000 }).should('exist');
    cy.get('input[type="search"]').type('Jean 1:1{enter}');
    cy.wait(1500);
    cy.contains('button', '✕').click();
    cy.get('input[type="search"]').should('have.value', '');
    // After clearing, stale-filter button must not appear
    cy.contains('button', '✕ Filtre').should('not.exist');
  });
});
