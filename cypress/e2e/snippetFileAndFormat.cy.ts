// Creating a snippet from a file and formatting it, against a deployed environment.
describe('Snippet from file and format', () => {
  const name = `cypress-file-${Date.now()}`
  const unformatted = 'let a:number=5;\nprintln(a);'
  let snippetId: string | undefined
  let token: string | undefined

  beforeEach(() => {
    cy.env(['AUTH0_USERNAME', 'AUTH0_PASSWORD']).then(({AUTH0_USERNAME, AUTH0_PASSWORD}) =>
        cy.loginToAuth0(AUTH0_USERNAME, AUTH0_PASSWORD))
    cy.intercept('GET', '**/api/snippets?*').as('list')
    cy.visit('/')
    // the page is ready (file types included) once the first list arrives
    cy.wait('@list')
  })

  after(() => {
    if (snippetId && token) {
      cy.request({method: 'DELETE', url: `/api/snippets/${snippetId}`, headers: {Authorization: token}, failOnStatusCode: false})
    }
  })

  it('creates a snippet by uploading a file', () => {
    cy.intercept('POST', '**/api/snippets').as('create')
    cy.get('[data-testid="upload-file-input"]').selectFile(
        {contents: Cypress.Buffer.from(unformatted), fileName: `${name}.prs`},
        {force: true},
    )
    // the file fills the create modal: name from the file name, code from its content
    cy.get('#name').should('have.value', name)
    cy.get('[data-testid="add-snippet-code-editor"] textarea').should('have.value', unformatted)
    cy.contains('button', 'Save Snippet').click()

    cy.wait('@create').then(({request, response}) => {
      expect(response?.statusCode).to.eq(201)
      snippetId = response?.body.id
      token = request.headers.authorization as string
    })
    cy.get('input[aria-label="search"]').type(name)
    cy.contains('[data-testid="snippet-row"]', name, {timeout: 10000}).should('be.visible')
  })

  it('formats the snippet', () => {
    cy.intercept('POST', '**/api/snippets/*/format').as('format')
    cy.get('input[aria-label="search"]').type(name)
    cy.contains('[data-testid="snippet-row"]', name, {timeout: 10000}).click()
    cy.get('textarea').first().should('have.value', unformatted)

    cy.get('[aria-label="Format"]').click()
    cy.wait('@format').its('response.statusCode').should('eq', 202)
    // formatting is asynchronous: the UI polls until printscript-service publishes the result
    cy.get('textarea', {timeout: 20000}).first().should('not.have.value', unformatted)
        .invoke('val').should('match', /number\s*=\s*5;/)

    // the formatted code is what got saved
    cy.then(() => cy.request({url: `/api/snippets/${snippetId}`, headers: {Authorization: token!}}))
        .its('body.content').should('not.eq', unformatted)
  })
})
