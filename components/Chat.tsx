'use client'

import { useState, useEffect, useRef } from 'react'
import { ChatMessage, Contact, ExtractResult, RawRow, QueueResponse, JobStatus } from '@/lib/types'
import { Button, Input, Spinner, cn } from '@/components/ui'
import { useTypewriter, usePrefersReducedMotion } from '@/components/useTypewriter'

/**
 * Berichten worden als HTML weergegeven, dus alles gaat er eerst doorheen dat
 * het onschadelijk maakt. Pas daarná krijgt het opmaak — anders is een
 * e-mailadres uit een geüpload bestand een manier om markup binnen te smokkelen.
 */
function format(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function Typewriter({ text, onDone }: { text: string; onDone: () => void }) {
  const reduced = usePrefersReducedMotion()
  const { shown, done } = useTypewriter(reduced ? '' : text)
  const visible = reduced ? text : shown

  useEffect(() => {
    if (reduced || done) onDone()
  }, [reduced, done, onDone])

  return <span dangerouslySetInnerHTML={{ __html: format(visible) }} />
}

interface Props {
  uploadTrigger: RawRow[] | null
  onContactsExtracted: (contacts: Contact[]) => void
}

type State = 'idle' | 'extracting' | 'awaiting_confirmation' | 'sending' | 'done'

/**
 * Bouwt het openingsbericht na het uploaden.
 *
 * Drie dingen, in deze volgorde: wat er gevonden is, wat eventueel opvalt, en
 * wat er gebeurt als je bevestigt. Die laatste zin is er niet voor de sier —
 * iemand die op een knop drukt die honderden mails verstuurt hoort te weten
 * namens wie dat gaat en dat er niets meer tussen zit.
 */
function buildOpener(data: ExtractResult): string {
  const { valid, invalid } = data.summary
  const regels: string[] = []

  if (valid === 0) {
    regels.push('Ik vind geen bruikbare e-mailadressen in dit bestand.')
  } else {
    regels.push(`Ik heb **${valid}** ${valid === 1 ? 'e-mailadres' : 'e-mailadressen'} uit je bestand gehaald.`)
  }

  if (invalid > 0) {
    const redenen = new Map<string, number>()
    for (const c of data.contacts.filter(c => !c.valid)) {
      const label =
        c.reason === 'duplicate' ? 'stond er dubbel in'
        : c.reason === 'missing' ? 'had geen adres'
        : 'had een ongeldig adres'
      redenen.set(label, (redenen.get(label) ?? 0) + 1)
    }
    const uitleg = [...redenen].map(([label, n]) => `${n} ${label}`).join(', ')
    regels.push(`${invalid} ${invalid === 1 ? 'rij is' : 'rijen zijn'} overgeslagen: ${uitleg}.`)
  }

  // Het oordeel van het model komt ná de feiten, zodat de cijfers niet
  // ondersneeuwen bij een waarschuwing die achteraf loos blijkt.
  if (data.assessment?.concern) {
    regels.push(`⚠︎ ${data.assessment.concern}`)
  }

  if (valid > 0) {
    regels.push(
      `Als je bevestigt, krijgen die ${valid} mensen één e-mail namens jouw bedrijf, ` +
      `met een link naar je Google-reviewpagina en onderaan een afmeldlink. ` +
      `Er gaat verder niets uit en niemand krijgt een herinnering.`
    )
    regels.push('Zal ik ze versturen?')
  } else {
    regels.push('Upload een ander bestand om het opnieuw te proberen.')
  }

  return regels.join('\n\n')
}

export default function Chat({ uploadTrigger, onContactsExtracted }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: 'Ik lees je bestand en zoek de e-mailadressen op…',
    timestamp: new Date(),
  }])
  const [input, setInput] = useState('')
  const [chatState, setChatState] = useState<State>('idle')
  const [pendingContacts, setPendingContacts] = useState<Contact[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const extractingRef = useRef(false)
  const lastTriggerRef = useRef<RawRow[] | null>(null)
  // Staat het laatste bericht er helemaal? Zo niet, dan zijn de knoppen weg.
  const [settled, setSettled] = useState(true)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!uploadTrigger || uploadTrigger.length === 0) return
    if (uploadTrigger === lastTriggerRef.current) return
    if (extractingRef.current) return
    lastTriggerRef.current = uploadTrigger
    runExtract(uploadTrigger)
  }, [uploadTrigger])

  function addMessage(role: 'user' | 'assistant', content: string) {
    // Een bericht van de assistent wordt uitgetypt; eentje van de gebruiker
    // staat er meteen, want die heeft hij zelf net geschreven.
    setSettled(role === 'user')
    setMessages(prev => [...prev, { role, content, timestamp: new Date() }])
  }

  async function runExtract(rows: RawRow[]) {
    if (extractingRef.current) return
    extractingRef.current = true
    setChatState('extracting')
    try {
      const res = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawData: rows }) })
      if (!res.ok) { const err = await res.json(); addMessage('assistant', `Er ging iets mis: ${err.error}`); setChatState('idle'); extractingRef.current = false; return }
      const data: ExtractResult = await res.json()
      setPendingContacts(data.contacts)
      onContactsExtracted(data.contacts)

      addMessage('assistant', buildOpener(data))
      setChatState(data.summary.valid > 0 ? 'awaiting_confirmation' : 'idle')
    } catch { addMessage('assistant', 'Kon het bestand niet analyseren. Probeer opnieuw.'); setChatState('idle') }
    finally { extractingRef.current = false }
  }

  async function runSend() {
    setChatState('sending')
    addMessage('assistant', 'Bezig met inplannen...')
    const valid = pendingContacts.filter(c => c.valid)
    try {
      const res = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contacts: valid }) })
      const data: QueueResponse = await res.json()

      if (!res.ok) {
        // De server weet beter wat er mis is dan wij: toon zijn melding, zodat
        // een maandlimiet of onbevestigd domein niet als "er ging iets mis"
        // bij de gebruiker aankomt.
        addMessage('assistant', data.error || 'Er ging iets mis bij het versturen. Probeer opnieuw.')
        setChatState('awaiting_confirmation')
        return
      }

      let msg = `${data.queued} reviewverzoeken staan klaar en worden nu verstuurd.`
      if (data.skippedUnsubscribed) {
        msg += `\n${data.skippedUnsubscribed} ${data.skippedUnsubscribed === 1 ? 'adres is' : 'adressen zijn'} overgeslagen wegens een eerdere afmelding.`
      }
      addMessage('assistant', msg)

      if (data.jobId) await pollJob(data.jobId)
    } catch { addMessage('assistant', 'Verbindingsfout. Probeer opnieuw.'); setChatState('awaiting_confirmation') }
  }

  /**
   * Verzenden gebeurt op de achtergrond, dus de chat volgt de voortgang via de
   * status van de opdracht in plaats van te wachten op één lang request.
   */
  async function pollJob(jobId: string) {
    const started = Date.now()

    while (Date.now() - started < 10 * 60_000) {
      await new Promise(r => setTimeout(r, 2500))

      let job: JobStatus
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        if (!res.ok) break
        job = await res.json()
      } catch { break }

      if (job.status === 'completed') {
        const msg = job.failed === 0
          ? `Klaar. Alle ${job.sent} reviewverzoeken zijn verstuurd.`
          : `${job.sent} van ${job.total} verstuurd, ${job.failed} mislukt (meestal een adres dat niet bestaat).`
        addMessage('assistant', msg + '\n\nJe kunt een nieuw bestand uploaden om opnieuw te beginnen.')
        setChatState('done')
        return
      }

      if (job.status === 'failed') {
        addMessage('assistant', 'Het versturen is vastgelopen. Neem contact op als dit blijft gebeuren.')
        setChatState('done')
        return
      }
    }

    addMessage('assistant', 'Het versturen loopt nog op de achtergrond. Je kunt dit venster sluiten.')
    setChatState('done')
  }

  function handleUserMessage(text: string) {
    if (!text.trim()) return
    addMessage('user', text); setInput('')
    const lower = text.toLowerCase().trim()
    if (chatState === 'awaiting_confirmation') {
      if (['ja','yes','ok','oké','akkoord','verstuur','stuur','go','yep','jep','doen'].some(w => lower.includes(w))) { runSend(); return }
      if (['nee','no','stop','annuleer','niet','cancel'].some(w => lower.includes(w))) { addMessage('assistant', 'Begrepen, ik stuur niets. Upload een nieuw bestand of typ je vraag.'); setChatState('idle'); return }
      answerFreeQuestion(lower); return
    }
    if (chatState === 'done' || chatState === 'idle') addMessage('assistant', 'Upload een nieuw klantenbestand links om opnieuw te beginnen.')
  }

  function answerFreeQuestion(q: string) {
    const valid = pendingContacts.filter(c => c.valid), invalid = pendingContacts.filter(c => !c.valid)
    if (q.includes('ongeldig') || q.includes('fout') || q.includes('invalid')) {
      if (invalid.length === 0) { addMessage('assistant', 'Er zijn geen ongeldige adressen.'); return }
      addMessage('assistant', `Ongeldige adressen:\n${invalid.map(c => `- ${c.name || 'onbekend'} — ${c.email || 'geen e-mail'} (${c.reason})`).join('\n')}`); return
    }
    if (q.includes('lijst') || q.includes('wie') || q.includes('welke')) {
      if (valid.length === 0) { addMessage('assistant', 'Geen geldige adressen gevonden.'); return }
      const preview = valid.slice(0, 10).map(c => `- ${c.name || '—'} · ${c.email}`).join('\n')
      addMessage('assistant', `Geldige ontvangers:\n${preview}${valid.length > 10 ? `\n...en ${valid.length - 10} meer.` : ''}`); return
    }
    if (q.includes('voorbeeld') || q.includes('preview') || q.includes('email') || q.includes('mail')) {
      const first = valid[0]
      if (!first) { addMessage('assistant', 'Geen geldige contacten om een voorbeeld te tonen.'); return }
      addMessage('assistant', `Voorbeeld e-mail:\n────────────────────\nOnderwerp: Bedankt voor uw bezoek\n\nHallo ${first.name || 'klant'},\nBedankt dat u voor ons heeft gekozen. Zou u een korte Google Review willen achterlaten?\n[Review achterlaten] (link)\n────────────────────`); return
    }
    addMessage('assistant', `Ik heb ${valid.length} geldige adressen klaarstaan. Wil je versturen? Typ "ja" of "nee".`)
  }

  const renderContent = format

  const busy = chatState === 'extracting' || chatState === 'sending'

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        {messages.map((m, i) => {
          const laatste = i === messages.length - 1
          return (
            <div key={i} className={cn('flex', m.role === 'user' && 'justify-end')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-md px-4 py-3 text-base',
                  m.role === 'user'
                    ? 'bg-navy text-surface'
                    : 'border border-line bg-canvas text-ink',
                )}
              >
                {m.role === 'assistant' && laatste && !settled ? (
                  <Typewriter text={m.content} onDone={() => setSettled(true)} />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: renderContent(m.content) }} />
                )}
              </div>
            </div>
          )
        })}

        {busy && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Spinner />
            Bezig…
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* De bevestiging is de kern van het scherm, dus die staat vast onderin
          en scrolt niet weg met het gesprek.

          Knoppen en tekstvak verschijnen pas als het bericht is uitgetypt. Je
          kunt niet bevestigen wat je nog niet hebt kunnen lezen — en juist de
          waarschuwing over een verkeerd bestand staat in die tekst. */}
      <div className={cn('shrink-0 border-t border-line p-4', !settled && 'opacity-0')}>
        {chatState === 'awaiting_confirmation' && (
          <div className="mb-4 flex gap-3">
            <Button onClick={() => handleUserMessage('ja')} disabled={!settled}>
              Ja, versturen
            </Button>
            <Button variant="secondary" onClick={() => handleUserMessage('nee')} disabled={!settled}>
              Nee, stoppen
            </Button>
          </div>
        )}

        <form
          onSubmit={e => { e.preventDefault(); handleUserMessage(input) }}
          className="flex gap-3"
        >
          <Input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={
              chatState === 'awaiting_confirmation' ? 'Stel een vraag over de lijst…'
              : chatState === 'done' ? 'Upload een nieuw bestand om opnieuw te beginnen'
              : 'Typ je antwoord…'
            }
            disabled={busy}
          />
          {/* Neutraal: goud blijft gereserveerd voor de bevestiging hierboven. */}
          <Button
            type="submit"
            variant="secondary"
            disabled={!input.trim() || busy}
            className="shrink-0"
          >
            Verstuur
          </Button>
        </form>
      </div>
    </div>
  )
}
