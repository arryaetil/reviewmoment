export interface Contact {
  name: string
  email: string
  valid: boolean
  reason?: 'missing' | 'invalid_format' | 'duplicate'
}

export interface ExtractResult {
  contacts: Contact[]
  summary: {
    total: number
    valid: number
    invalid: number
  }
}

export interface SendResult {
  sent: number
  failed: number
  errors: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Raw row from parsed file — any key/value shape
export type RawRow = Record<string, string | number | null | undefined>
