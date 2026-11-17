// Sharing a snippet between two real users, against a deployed environment.
describe('Share snippet', () => {
  const name = `cypress-share-${Date.now()}`
  const code = 'let shared: number = 1;\nprintln(shared);'
  let snippetId: string | undefined
  let ownerToken: string | undefined

  const loginAs = (user: 'owner' | 'reader') => {
    const [userKey, passKey] = user === 'owner'
        ? ['AUTH0_USERNAME', 'AUTH0_PASSWORD']
        : ['AUTH0_USERNAME_2', 'AUTH0_PASSWORD_2']
    cy.env([userKey, passKey]).then(env => cy.loginToAuth0(env[userKey], env[passKey]))
    cy.intercept('GET', '**/api/snippets?*').as('list')
    cy.visit('/')
    cy.wait('@list')
  }

  const searchAndOpen = () => {
    cy.get('input[aria-label="search"]').clear().type(name)
    cy.contains('[data-testid="snippet-row"]', name, {timeout: 10000}).click()
  }

  after(() => {
    if (snippetId && ownerToken) {
      cy.request({method: 'DELETE', url: `/api/snippets/${snippetId}`, headers: {Authorization: ownerToken}, failOnStatusCode: false})
    }
  })

  it('the owner creates a snippet and shares it with another user found by email', () => {
    loginAs('owner')
    cy.intercept('POST', '**/api/snippets').as('create')
    cy.contains('button', 'Add Snippet').click()
    cy.contains('li', 'Create snippet').click()
    cy.get('#name').type(name)
    cy.get('#demo-simple-select').click()
    cy.get('[data-testid="menu-option-printscript"]').click()
    cy.get('[data-testid="add-snippet-code-editor"] textarea').type(code)
    cy.contains('button', 'Save Snippet').click()
    cy.wait('@create').then(({request, response}) => {
      expect(response?.statusCode).to.eq(201)
      snippetId = response?.body.id
      ownerToken = request.headers.authorization as string
    })

    cy.intercept('GET', '**/api/users?*').as('users')
    cy.intercept('POST', '**/api/snippets/*/shares').as('share')
    searchAndOpen()
    cy.get('[aria-label="Share"]').click()
    cy.env(['AUTH0_USERNAME_2']).then(({AUTH0_USERNAME_2}) => {
      cy.get('input[type="text"]').filter(':visible').last().type(AUTH0_USERNAME_2)
      cy.wait('@users').its('response.statusCode').should('eq', 200)
      cy.contains('[role="option"]', AUTH0_USERNAME_2, {timeout: 10000}).click()
    })
    cy.contains('button', /^Share$/).click()
    cy.wait('@share').its('response.statusCode').should('eq', 204)
    cy.contains('Snippet shared with').should('be.visible')
  })

  it('the other user sees the shared snippet and can open it', () => {
    loginAs('reader')
    searchAndOpen()
    cy.get('textarea').first().should('have.value', code)
  })

  it('the other user cannot delete it', () => {
    loginAs('reader')
    // the reader's own token, taken from the app's list request
    cy.get('@list').then(list => {
      const token = (list as unknown as {request: {headers: Record<string, string>}}).request.headers.authorization
      cy.request({method: 'DELETE', url: `/api/snippets/${snippetId}`, headers: {Authorization: token}, failOnStatusCode: false})
          .its('status').should('eq', 403)
    })
  })
})
