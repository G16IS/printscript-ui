const source = 'let x: number = "Hola!";\nprintln(x);'
const validSource = 'let x: string = "Hola!";\nprintln(x);'
const snippet = {id: 'snippet-1', name: 'Greeting', language: 'printscript', lintStatus: 'PENDING', content: 'println(1);'}
const invalid = {
  statusCode: 400,
  body: {
    title: 'Snippet is not valid',
    detail: 'The snippet breaks rules of printscript 1.1',
    errors: [
      {rule: 'type: Expected number, found string', line: 1, column: 17},
      {rule: 'syntax: Expected SEMICOLON, found LEFT_PAREN', line: 2, column: 6},
    ],
  },
}
const unavailable = {
  statusCode: 503,
  body: {title: 'Snippet validation unavailable', detail: 'Could not validate the snippet; please try again later'},
}

// the fixture page is served only by the local Vite dev server, a deployed build redirects it to Auth0
const servesFixtures = Cypress.config('baseUrl')?.startsWith('http://localhost')

;(servesFixtures ? describe : describe.skip)('Snippet validation errors', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/snippets/snippet-1', snippet).as('snippet')
    cy.intercept('GET', '**/snippets/snippet-1/tests', []).as('tests')
  })

  const openCreate = () => {
    cy.visit('/cypress/fixtures/snippet-validation.html?mode=create')
    cy.get('#name').type('Greeting')
    cy.get('[data-testid="add-snippet-code-editor"] textarea').type(source, {parseSpecialCharSequences: false})
  }

  const openEdit = () => {
    cy.visit('/cypress/fixtures/snippet-validation.html?mode=edit')
    cy.wait('@snippet')
    cy.get('textarea').first().clear().type(source, {parseSpecialCharSequences: false})
  }

  const expectValidationErrors = () => {
    cy.get('[role="alert"]').should('contain', 'Line 1, column 17: type: Expected number, found string')
      .and('contain', 'Line 2, column 6: syntax: Expected SEMICOLON, found LEFT_PAREN')
  }

  it('keeps a rejected creation open, shows positioned errors, and closes only after a successful retry', () => {
    cy.intercept('POST', '**/snippets', invalid).as('create')
    openCreate()
    cy.contains('button', 'Save Snippet').click()
    cy.wait('@create')
    expectValidationErrors()
    cy.get('#name').should('have.value', 'Greeting')
    cy.get('[data-testid="add-snippet-code-editor"] textarea').should('have.value', source)

    cy.intercept('POST', '**/snippets', {statusCode: 201, body: snippet}).as('retry')
    cy.get('[data-testid="add-snippet-code-editor"] textarea').clear().type(validSource, {parseSpecialCharSequences: false})
    cy.contains('button', 'Save Snippet').click()
    cy.wait('@retry')
    cy.contains('button', 'Save Snippet').should('not.exist')
    cy.get('[role="alert"]').should('not.exist')
  })

  it('shows unavailable validation on creation without losing the draft', () => {
    cy.intercept('POST', '**/snippets', unavailable).as('create')
    openCreate()
    cy.contains('button', 'Save Snippet').click()
    cy.wait('@create')
    cy.get('[role="alert"]').should('contain', 'Could not save snippet')
      .and('contain', unavailable.body.detail)
    cy.get('[data-testid="add-snippet-code-editor"] textarea').should('have.value', source)
    cy.contains('button', 'Save Snippet').should('be.enabled')
  })

  it('handles a network failure without an unhandled rejection or losing the draft', () => {
    cy.intercept('POST', '**/snippets', {forceNetworkError: true}).as('create')
    openCreate()
    cy.contains('button', 'Save Snippet').click()
    cy.wait('@create')
    cy.get('[role="alert"]').should('contain', 'Could not reach the server')
    cy.get('[data-testid="add-snippet-code-editor"] textarea').should('have.value', source)
  })

  it('clears an old creation error when the modal is reopened', () => {
    cy.intercept('POST', '**/snippets', invalid).as('create')
    openCreate()
    cy.contains('button', 'Save Snippet').click()
    cy.wait('@create')
    expectValidationErrors()
    cy.get('body').type('{esc}')
    cy.contains('button', 'Reopen').click()
    cy.get('[role="alert"]').should('not.exist')
    cy.get('[data-testid="add-snippet-code-editor"] textarea').should('have.value', source)
  })

  it('preserves rejected edits and clears the error after a successful retry', () => {
    cy.intercept('PUT', '**/snippets/snippet-1', invalid).as('save')
    openEdit()
    cy.get('[data-testid="SaveIcon"]').click()
    cy.wait('@save')
    expectValidationErrors()
    cy.get('textarea').first().should('have.value', source)

    cy.intercept('PUT', '**/snippets/snippet-1', {...snippet, content: validSource}).as('retry')
    cy.intercept('GET', '**/snippets/snippet-1', {...snippet, content: validSource})
    cy.get('textarea').first().clear().type(validSource, {parseSpecialCharSequences: false})
    cy.get('[data-testid="SaveIcon"]').click()
    cy.wait('@retry')
    cy.get('[role="alert"]').filter(':contains("Could not save snippet")').should('not.exist')
    cy.get('textarea').first().should('have.value', validSource)
  })

  it('shows unavailable validation on edits without replacing the code', () => {
    cy.intercept('PUT', '**/snippets/snippet-1', unavailable).as('save')
    openEdit()
    cy.get('[data-testid="SaveIcon"]').click()
    cy.wait('@save')
    cy.get('[role="alert"]').should('contain', 'Could not save snippet')
      .and('contain', unavailable.body.detail)
    cy.get('textarea').first().should('have.value', source)
  })

  it('shows positioned validation errors when formatting first tries to save an invalid edit', () => {
    cy.intercept('PUT', '**/snippets/snippet-1', invalid).as('save')
    openEdit()
    cy.get('[data-testid="ReadMoreIcon"]').click()
    cy.wait('@save')
    expectValidationErrors()
    cy.get('textarea').first().should('have.value', source)
  })

  it('clears an old formatting error after saving a corrected edit', () => {
    cy.intercept('PUT', '**/snippets/snippet-1', invalid).as('save')
    openEdit()
    cy.get('[data-testid="ReadMoreIcon"]').click()
    cy.wait('@save')
    expectValidationErrors()

    cy.intercept('PUT', '**/snippets/snippet-1', {...snippet, content: validSource}).as('retry')
    cy.intercept('GET', '**/snippets/snippet-1', {...snippet, content: validSource})
    cy.get('textarea').first().clear().type(validSource, {parseSpecialCharSequences: false})
    cy.get('[data-testid="SaveIcon"]').click()
    cy.wait('@retry')
    cy.get('[role="alert"]').should('not.contain', 'Expected number')
  })

  it('clears an old save error after successfully formatting a corrected edit', () => {
    cy.intercept('PUT', '**/snippets/snippet-1', invalid).as('save')
    openEdit()
    cy.get('[data-testid="SaveIcon"]').click()
    cy.wait('@save')
    expectValidationErrors()

    let content = snippet.content
    cy.intercept('GET', '**/snippets/snippet-1', req => req.reply({...snippet, content}))
    cy.intercept('PUT', '**/snippets/snippet-1', req => {
      content = req.body.content
      req.reply({...snippet, content})
    }).as('retry')
    cy.intercept('POST', '**/snippets/snippet-1/format', {statusCode: 202})
    cy.intercept('GET', '**/snippets/snippet-1/format', {status: 'DONE', error: null})
    cy.get('textarea').first().clear().type(validSource, {parseSpecialCharSequences: false})
    cy.get('[data-testid="ReadMoreIcon"]').click()
    cy.wait('@retry')
    cy.get('[role="alert"]').should('not.contain', 'Could not save snippet')
    cy.get('textarea').first().should('have.value', validSource)
  })
})
