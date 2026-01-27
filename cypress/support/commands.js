Cypress.Commands.add('visitWithCleanState', (path) => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('language', 'en');
      win.localStorage.removeItem('cart');
      win.localStorage.removeItem('checkoutState_v1');
      win.sessionStorage.removeItem('adminToken');
      win.sessionStorage.removeItem('adminUser');
    }
  });
});

Cypress.Commands.add('apiAdminLogin', (username = 'bojole_admin', password = 'bojole123') => {
  cy.request('POST', '/api/login', { username, password }).then((resp) => {
    expect(resp.status).to.eq(200);
    expect(resp.body).to.have.property('success', true);
    expect(resp.body).to.have.property('token');

    const token = resp.body.token;

    cy.visit('/admin', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('adminToken', token);
        win.sessionStorage.setItem('adminUser', username);
        win.localStorage.setItem('language', 'en');
      }
    });
  });
});
