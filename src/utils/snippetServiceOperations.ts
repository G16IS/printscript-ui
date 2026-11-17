import axios, {AxiosInstance} from 'axios'
import autoBind from 'auto-bind'
import {SnippetOperations} from './snippetOperations'
import {ComplianceEnum, CreateSnippet, PaginatedSnippets, Snippet, UpdateSnippet} from './snippet'
import {PaginatedUsers, User} from './users.ts'
import {TestCase} from '../types/TestCase.ts'
import {TestCaseResult} from './queries.tsx'
import {FileType} from '../types/FileType.ts'
import {Rule} from '../types/Rule.ts'

const BACKEND_URL: string = import.meta.env.VITE_BACKEND_URL || '/api'

// shortcut: only PrintScript 1.1 (the current version in snippet-service), add a language/version endpoint when there are more
const PRINTSCRIPT_VERSION = '1.1'
const FILE_TYPES: FileType[] = [{language: 'printscript', extension: 'prs'}]

const COMPLIANCE: Record<string, ComplianceEnum> = {
  PENDING: 'pending',
  VALID: 'compliant',
  INVALID: 'not-compliant',
}

type SnippetListItem = { id: string, ownerId: string, name: string, language: string, lintStatus: string }
type SnippetListResponse = { items: SnippetListItem[], page: number, size: number, total: number }
type SnippetDetailResponse = { id: string, name: string, language: string, content: string, lintStatus: string }

const toSnippet = (s: { id: string, name: string, language: string, lintStatus: string }, content = '', author = ''): Snippet => ({
  id: s.id,
  name: s.name,
  language: s.language,
  extension: FILE_TYPES.find(f => f.language === s.language)?.extension ?? 'txt',
  content,
  author,
  compliance: COMPLIANCE[s.lintStatus] ?? 'pending',
})

type TestCaseResponse = { id: string, name: string, inputs: string[], expectedOutputs: string[] }

const toTestCase = (t: TestCaseResponse): TestCase => ({id: t.id, name: t.name, input: t.inputs, output: t.expectedOutputs})

type FormatStatusResponse = { status: 'NONE' | 'REQUESTED' | 'DONE' | 'FAILED' | 'ERROR', error: string | null }
type TestResultResponse = { testId: string, status: 'RUNNING' | 'OK' | 'FAILED' | 'ERROR', outputs: string[], error: string | null }

const TIMED_OUT = 'Timed out'

// calls fn until it returns a defined value; fn throwing stops the polling at once
const poll = async <T>(fn: () => Promise<T | undefined>, attempts = 15, delayMs = 1000): Promise<T> => {
  for (let i = 0; i < attempts; i++) {
    const value = await fn()
    if (value !== undefined) return value
    if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs))
  }
  throw new Error(TIMED_OUT)
}

export class SnippetServiceOperations implements SnippetOperations {
  private readonly http: AxiosInstance

  constructor(getAccessToken: () => Promise<string>) {
    autoBind(this)
    this.http = axios.create({baseURL: BACKEND_URL})
    this.http.interceptors.request.use(async config => {
      config.headers.Authorization = `Bearer ${await getAccessToken()}`
      return config
    })
  }

  async listSnippetDescriptors(page: number, pageSize: number, snippetName?: string): Promise<PaginatedSnippets> {
    // the backend rejects a blank name, so it is only sent when there is one
    const params = {page, size: pageSize, ...(snippetName?.trim() ? {name: snippetName.trim()} : {})}
    const {data} = await this.http.get<SnippetListResponse>('/snippets', {params})
    return {
      page: data.page,
      page_size: data.size,
      count: data.total,
      snippets: data.items.map(item => toSnippet(item, '', item.ownerId)),
    }
  }

  async getSnippetById(id: string): Promise<Snippet> {
    const {data} = await this.http.get<SnippetDetailResponse>(`/snippets/${id}`)
    return toSnippet(data, data.content)
  }

  async createSnippet(createSnippet: CreateSnippet): Promise<Snippet> {
    const form = new FormData()
    form.append('file', new Blob([createSnippet.content], {type: 'text/plain'}), `${createSnippet.name}.${createSnippet.extension}`)
    form.append('name', createSnippet.name)
    form.append('language', createSnippet.language)
    form.append('version', PRINTSCRIPT_VERSION)
    const {data} = await this.http.post<SnippetDetailResponse>('/snippets', form)
    return toSnippet(data, createSnippet.content)
  }

  async shareSnippet(snippetId: string, userId: string): Promise<Snippet> {
    await this.http.post(`/snippets/${snippetId}/shares`, {targetUserId: userId})
    return this.getSnippetById(snippetId)
  }

  async getUserFriends(name: string = '', page: number = 0, pageSize: number = 10): Promise<PaginatedUsers> {
    const {data} = await this.http.get<{ page: number, pageSize: number, count: number, users: User[] }>('/users', {
      params: {name: name.trim(), page, pageSize},
    })
    return {page: data.page, page_size: data.pageSize, count: data.count, users: data.users}
  }

  getFileTypes(): Promise<FileType[]> {
    return Promise.resolve(FILE_TYPES)
  }

  async updateSnippetById(id: string, updateSnippet: UpdateSnippet): Promise<Snippet> {
    const {data} = await this.http.put<SnippetDetailResponse>(`/snippets/${id}`, {content: updateSnippet.content})
    return toSnippet(data, data.content)
  }

  async deleteSnippet(id: string): Promise<string> {
    await this.http.delete(`/snippets/${id}`)
    return id
  }

  async formatSnippet(snippetId: string, content: string): Promise<string> {
    // the format job reads the saved content, so unsaved edits are saved first
    if ((await this.getSnippetById(snippetId)).content !== content) {
      await this.updateSnippetById(snippetId, {content})
    }
    await this.http.post(`/snippets/${snippetId}/format`)
    await poll<true>(async () => {
      const {data} = await this.http.get<FormatStatusResponse>(`/snippets/${snippetId}/format`)
      if (data.status === 'DONE') return true
      if (data.status === 'FAILED' || data.status === 'ERROR') throw new Error(data.error ?? 'Formatting failed')
      return undefined
    }).catch(e => {
      throw e.message === TIMED_OUT ? new Error('Formatting is taking too long') : e
    })
    return (await this.getSnippetById(snippetId)).content
  }

  async getFormatRules(): Promise<Rule[]> {
    const {data} = await this.http.get<Rule[]>('/rules/format')
    return data
  }

  async getLintingRules(): Promise<Rule[]> {
    const {data} = await this.http.get<Rule[]>('/rules/lint')
    return data
  }

  async modifyFormatRule(newRules: Rule[]): Promise<Rule[]> {
    const {data} = await this.http.put<Rule[]>('/rules/format', newRules)
    return data
  }

  async modifyLintingRule(newRules: Rule[]): Promise<Rule[]> {
    const {data} = await this.http.put<Rule[]>('/rules/lint', newRules)
    return data
  }

  async getTestCases(snippetId: string): Promise<TestCase[]> {
    const {data} = await this.http.get<TestCaseResponse[]>(`/snippets/${snippetId}/tests`)
    return data.map(toTestCase)
  }

  async postTestCase(snippetId: string, testCase: Partial<TestCase>): Promise<TestCase> {
    const {data} = await this.http.post<TestCaseResponse>(`/snippets/${snippetId}/tests`, {
      name: testCase.name,
      inputs: testCase.input ?? [],
      expectedOutputs: testCase.output ?? [],
    })
    // the backend has no update: create the new test first, then drop the old one, so a failure never loses the test
    if (testCase.id) {
      await this.removeTestCase(snippetId, testCase.id)
        .catch(e => console.warn(`Could not delete the replaced test ${testCase.id}, a duplicate remains`, e))
    }
    return toTestCase(data)
  }

  async removeTestCase(snippetId: string, testId: string): Promise<string> {
    await this.http.delete(`/snippets/${snippetId}/tests/${testId}`)
    return testId
  }

  async testSnippet(snippetId: string, testCase: Partial<TestCase>): Promise<TestCaseResult> {
    const testId = testCase.id
    if (!testId) throw new Error('Save the test before running it')
    // the run covers all the snippet's tests, so the result is looked up by this test's id
    const {status} = await this.http.post(`/snippets/${snippetId}/tests/run`)
    if (status === 204) throw new Error('This snippet has no tests')
    return poll<TestCaseResult>(async () => {
      const {data} = await this.http.get<TestResultResponse[]>(`/snippets/${snippetId}/tests/results`)
      const result = data.find(r => r.testId === testId)
      if (!result || result.status === 'RUNNING') return undefined
      if (result.status === 'ERROR') throw new Error(result.error ?? 'Test failed to run')
      return result.status === 'OK' ? 'success' : 'fail'
    }).catch(e => {
      throw e.message === TIMED_OUT ? new Error('Test is taking too long') : e
    })
  }
}
