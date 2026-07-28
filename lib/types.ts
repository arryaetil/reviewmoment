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
  /*
   * Het openingsbericht, geschreven door het model en gecontroleerd op
   * verzonnen aantallen. Valt terug op een vaste tekst als dat misgaat.
   */
  opener?: string
  /*
   * Het oordeel van het model over het bestand als geheel. Bewust gescheiden
   * van de contacten: die zijn feitelijk, dit is een inschatting. Ontbreekt hij,
   * dan gaat de chat gewoon door zonder waarschuwing.
   */
  assessment?: {
    looksLikeCustomerList: boolean
    concern: string | null
  }
}

/** Antwoord van /api/send: de opdracht is ingepland, nog niet verstuurd. */
export interface QueueResponse {
  jobId?: string
  queued?: number
  skippedUnsubscribed?: number
  remainingThisMonth?: number
  error?: string
}

/** Antwoord van /api/jobs/[id]: voortgang van een verzendopdracht. */
export interface JobStatus {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  total: number
  sent: number
  failed: number
  createdAt: string
  completedAt: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Raw row from parsed file — any key/value shape
export type RawRow = Record<string, string | number | null | undefined>
