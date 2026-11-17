// Full snippet lifecycle against a deployed environment: create, find, open, edit and delete.
describe('Snippet lifecycle', () => {
  const name = `cypress-${Date.now()}`
  const code = 'let a: number = 5;\nprintln(a);'
  const editedCode = 'let b: number = 7;\nprintln(b);'
  let snippetId: string | undefined
  let token: string | undefined

  beforeEach(() => {
    cy.env(['AUTH0_USERNAME', 'AUTH0_PASSWORD']).then(({AUTH0_USERNAME, AUTH0_PASSWORD}) =>
        cy.loginToAuth0(AUTH0_USERNAME, AUTH0_PASSWORD))
    cy.intercept('GET', '**/api/snippets?*').as('list')
    cy.visit('/')
  })

  // the snippet is created by the test, so a failure halfway must not leave it behind
  after(() => {
    if (snippetId && token) {
      cy.request({method: 'DELETE', url: `/api/snippets/${snippetId}`, headers: {Authorization: token}, failOnStatusCode: false})
    }
  })

  const searchAndOpen = () => {
    cy.get('input[aria-label="search"]').clear().type(name)
    cy.contains('[data-testid="snippet-row"]', name, {timeout: 10000}).click()
  }

  it('creates a snippet and finds it in the list', () => {
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
      token = request.headers.authorization as string
    })
    cy.contains('Add Snippet').should('be.visible')
    cy.get('input[aria-label="search"]').type(name)
    cy.contains('[data-testid="snippet-row"]', name, {timeout: 10000}).should('be.visible')
  })

  it('opens the snippet and shows its code', () => {
    searchAndOpen()
    cy.get('textarea').first().should('have.value', code)
  })

  it('edits and saves the code', () => {
    cy.intercept('PUT', '**/api/snippets/*').as('update')
    searchAndOpen()
    cy.get('textarea').first().clear().type(editedCode)
    cy.get('[aria-label="Save changes"]').click()
    cy.wait('@update').its('response.statusCode').should('eq', 200)

    cy.visit('/')
    searchAndOpen()
    cy.get('textarea').first().should('have.value', editedCode)
  })

  it('deletes the snippet', () => {
    cy.intercept('DELETE', '**/api/snippets/*').as('delete')
    searchAndOpen()
    cy.get('[aria-label="Delete"]').click()
    cy.contains('button', /^Delete$/).click()
    cy.wait('@delete').its('response.statusCode').should('be.oneOf', [200, 204])
    cy.request({url: `/api/snippets/${snippetId}`, headers: {Authorization: token!}, failOnStatusCode: false})
        .its('status').should('eq', 404)
    snippetId = undefined

    cy.visit('/')
    cy.wait('@list')
    cy.intercept('GET', `**/api/snippets?*name=${name}*`).as('search')
    cy.get('input[aria-label="search"]').type(name)
    cy.wait('@search').its('response.body.items').should('have.length', 0)
    cy.contains('[data-testid="snippet-row"]', name).should('not.exist')
  })
})
