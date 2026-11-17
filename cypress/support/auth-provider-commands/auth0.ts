// Logs in through the Auth0 Universal Login page and waits until it redirects back to the app.
export function loginViaAuth0Ui(username: string, password: string) {
  cy.visit('/')

  cy.origin(
      `https://${Cypress.expose('AUTH0_DOMAIN')}`,
      {args: {username, password}},
      ({username, password}) => {
        cy.get('input#username').type(username)
        cy.get('input#password').type(password, {log: false})
        cy.get('button[type=submit][name=action]').filter(':visible').first().click()
      }
  )

  cy.location('origin').should('equal', Cypress.config('baseUrl'))
  cy.contains('Printscript').should('be.visible')
}
