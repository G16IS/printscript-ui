import axios from 'axios'

type Problem = {
  detail?: string
  errors?: {rule: string, line: number, column: number}[]
}

export const snippetErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<Problem>(error)) {
    const problem = error.response?.data
    const issues = Array.isArray(problem?.errors) ? problem.errors : []
    const messages = issues
      .filter(issue => issue && typeof issue.rule === 'string' &&
        typeof issue.line === 'number' && typeof issue.column === 'number')
      .map(issue => `Line ${issue.line}, column ${issue.column}: ${issue.rule}`)
    if (messages.length) return messages.join('\n')
    if (typeof problem?.detail === 'string' && problem.detail) return problem.detail
    if (error.response?.status === 503) return 'The service is unavailable. Please try again.'
    if (!error.response) return 'Could not reach the server. Please try again.'
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
}
