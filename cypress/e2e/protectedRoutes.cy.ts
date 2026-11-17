describe('Protected routes', () => {
  it('redirects to the Auth0 login when not authenticated', () => {
    cy.visit('/')
    cy.location('hostname', {timeout: 10000}).should('equal', Cypress.expose('AUTH0_DOMAIN'))
  })

  it('shows the app once logged in', () => {
    cy.env(['AUTH0_USERNAME', 'AUTH0_PASSWORD']).then(({AUTH0_USERNAME, AUTH0_PASSWORD}) =>
        cy.loginToAuth0(AUTH0_USERNAME, AUTH0_PASSWORD))
    cy.visit('/')
    cy.location('origin').should('equal', Cypress.config('baseUrl'))
    cy.contains('Printscript').should('be.visible')
  })
})
