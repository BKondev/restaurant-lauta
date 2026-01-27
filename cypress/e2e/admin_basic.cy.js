describe('Admin panel basics', () => {
  it('logs in and can save restaurant settings', () => {
    cy.apiAdminLogin();

    cy.location('pathname').should('include', '/admin');
    cy.get('button.admin-tab-btn').should('exist');

    // Open Restaurant settings tab
    cy.contains('button.admin-tab-btn', 'Restaurant').click({ force: true });

    cy.on('window:alert', (msg) => {
      expect(String(msg)).to.match(/updated successfully/i);
    });

    cy.get('#restaurant-name-input').clear().type('BOJOLE (Cypress)');
    cy.contains('button', 'Update Settings').click();
  });

  it('payment config reports card disabled by default', () => {
    cy.request('/api/payments/config').then((resp) => {
      expect(resp.status).to.eq(200);
      expect(resp.body).to.have.nested.property('cardPayments.enabled', false);
    });
  });
});
