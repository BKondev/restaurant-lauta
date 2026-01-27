describe('Storefront checkout', () => {
  it('auto-selects cash when card payments are disabled and can place an order', () => {
    cy.visitWithCleanState('/');

    // Add first product to cart
    cy.get('#products-container .add-to-cart-btn').first().click();
    cy.get('#cart-count').should('not.have.text', '0');

    // Go to checkout
    cy.get('#cart-button').click();
    cy.location('pathname').should('include', '/checkout');

    // Pickup selection shows an informational alert; ignore it.
    // We keep a single handler so it doesn't get duplicated.
    cy.on('window:alert', (msg) => {
      const text = String(msg);
      if (text.toLowerCase().includes('heads up')) return;
      expect(text).to.match(/Order placed successfully/i);
    });

    // Step 1: use pickup to avoid delivery-hour restrictions before 11:00
    cy.contains('label.delivery-option', 'Pickup').click();

    // Step 2: order time
    cy.contains('label.delivery-option', 'Now').click();

    // Step 3: payment should be cash (card not available)
    cy.get('input[name="payment"][value="cash"]').should('be.checked');
    cy.get('input[name="payment"][value="card"]').should('not.exist');

    // Customer info
    cy.get('#customer-name').clear().type('Cypress Tester');
    cy.get('#customer-phone').clear().type('+359888000000');
    cy.get('#customer-email').clear().type('tester@example.com');

    // No address required for pickup

    // Place order
    cy.window().then((win) => {
      cy.stub(win, 'navigateTo').as('navigateTo');
    });
    cy.get('button.checkout-btn').click();

    cy.get('@navigateTo').should('have.been.calledWithMatch', /\/resturant-website\/?$/);
  });
});
