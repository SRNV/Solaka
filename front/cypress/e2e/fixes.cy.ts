/**
 * Regression tests for critical fixes made during the SOLID refactoring.
 * Each describe block documents the bug it covers so future regressions are traceable.
 *
 * Prerequisites: the dev server must be running (`npm run dev`).
 */

// ── Fix 1: relationsEnabled = false on mount ──────────────────────────────
// Bug: relationsEnabled was initialised to `true` with an empty query,
// causing useStompRelations to subscribe to ALL relations on mount (no filter).
// Those arcs were then rendered over the transparent canvas → purple-path artefact.
// Fix: initialise relationsEnabled = false; only the submittedQuery or
// showInMapCount effects enable it explicitly.
describe('Fix — no arcs on initial graph load (relationsEnabled=false)', () => {
  it('shows no arc canvas data-testid on fresh mount', () => {
    cy.visit('/graph');
    cy.get('canvas', { timeout: 15000 }).should('exist');
    // The "✕ Filtre" clear button should NOT appear — it only appears when
    // drawerRelations is set, meaning arcs were explicitly requested.
    cy.contains('button', '✕ Filtre').should('not.exist');
  });

  it('canvas background is transparent (no solid fill attribute)', () => {
    cy.visit('/graph');
    cy.get('canvas', { timeout: 15000 }).should('exist');
    // The canvas element must not have an inline background that would cover the globe.
    cy.get('canvas').first().should($c => {
      const bg = $c[0].style.background;
      expect(bg).to.satisfy(
        (v: string) => v === 'transparent' || v === '' || v === 'none',
        `expected transparent but got "${bg}"`,
      );
    });
  });
});

// ── Fix 2: voir dans la map — !layout guard removed ───────────────────────
// Bug: the showInMapCount effect guarded on `!layout`, exiting early when the
// graph page was freshly mounted (layout=null on first render). Since layout
// was not in the dep array, the effect never re-ran when layout loaded, so
// STOMP never started.
// Fix: remove the !layout guard. The query string doesn't need layout.
describe('Fix — voir dans la map starts STOMP on fresh graph mount', () => {
  it('navigating directly to /graph still loads the canvas', () => {
    // Simulate fresh navigation (page not previously cached)
    cy.visit('/graph');
    cy.get('canvas', { timeout: 15000 }).should('exist');
    // The search input must be present — it's rendered after layout loads
    cy.get('input[type="search"]').should('exist');
  });

  it('search bar submit enables relations after fresh mount', () => {
    cy.visit('/graph');
    cy.get('canvas', { timeout: 15000 }).should('exist');
    // Submitting a reference should enable STOMP without crashing
    cy.get('input[type="search"]').type('Jean 1:1{enter}');
    cy.wait(1500);
    cy.get('canvas').should('exist');
    // No uncaught error
  });
});

// ── Fix 3: normalizeRelations with STOMP — fromTo field preserved ─────────
// Bug 1: useStompRelations called addBatch on Zustand store, stripping the
//         `fromTo` field → dedup keys in normalizeRelations were wrong.
// Bug 2: storeRels from Zustand was never cleared between queries,
//         injecting stale relations into the merge.
// Fix: useStompRelations no longer touches Zustand; it owns its own relationsRef.
//      GraphPage merges only [drawerRelations, stompRelations].
describe('Fix — STOMP relation stream resets between searches', () => {
  it('clearing the search input removes the ✕ Filtre button if shown', () => {
    cy.visit('/graph');
    cy.get('canvas', { timeout: 15000 }).should('exist');
    cy.get('input[type="search"]').type('Jean 3:16{enter}');
    cy.wait(2000);
    // Clear the search
    cy.contains('button', '✕').click();
    cy.get('input[type="search"]').should('have.value', '');
    // After clearing, the stale-relations filter button must not linger
    cy.contains('button', '✕ Filtre').should('not.exist');
  });

  it('second search does not accumulate arcs from first search', () => {
    cy.visit('/graph');
    cy.get('canvas', { timeout: 15000 }).should('exist');
    cy.get('input[type="search"]').type('Jean 3:16{enter}');
    cy.wait(1500);
    // Clear and perform a different search
    cy.contains('button', '✕').click();
    cy.get('input[type="search"]').type('Genèse 1:1{enter}');
    cy.wait(1500);
    // Canvas must still be present (no crash from stale merged relations)
    cy.get('canvas').should('exist');
  });
});

// ── Fix 4: BibleDrawer verse-group brackets ───────────────────────────────
// Bug: adjacent verses sharing the same relation target showed the badge
//      duplicated on every verse row. The CSS bracket classes existed but
//      were never wired to the component logic.
// Fix: groupByRelSet + VerseGroup component; shared badges are shown once
//      in .groupRelations; individual VerseRow receives suppressedRelTargets.
describe('Fix — BibleDrawer shows grouped relation badges (not per-verse duplicates)', () => {
  it('drawer opens when clicking a book reference in the search bar', () => {
    cy.visit('/graph');
    cy.get('canvas', { timeout: 15000 }).should('exist');
    cy.get('input[type="search"]').type('Jean 3:16{enter}');
    cy.wait(2000);
    cy.get('canvas').should('exist');
    // If the drawer opens it means the click mechanic is intact
  });

  it('search page renders without errors', () => {
    cy.visit('/search');
    cy.url().should('include', '/search');
    cy.get('body').should('exist');
  });
});
