'use client'

import { useState, useEffect, useRef } from 'react'
import { ChatMessage, Contact, ExtractResult, RawRow, QueueResponse, JobStatus } from '@/lib/types'
import { Button, Input, Spinner, cn } from '@/components/ui'
import { useTypewriter, usePrefersReducedMotion } from '@/components/useTypewriter'
import { deterministicOpener } from '@/lib/chat/opener'

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
  const [answering, setAnswering] = useState(false)

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

    /*
     * Een nieuw bestand begint een nieuw gesprek.
     *
     * Eerder bleef alles staan: de oude berichten, de vorige contacten en de
     * toestand van de afgeronde verzending. Wie na "upload een nieuw bestand"
     * een bestand koos, zag zijn oude gesprek en een scherm dat niet reageerde.
     * Erger nog: de knop stond dan onder een lijst die al verstuurd was.
     */
    setMessages([{ role: 'assistant', content: 'Ik lees je bestand en zoek de e-mailadressen op…', timestamp: new Date() }])
    setPendingContacts([])
    setSettled(true)
    setChatState('extracting')
    try {
      const res = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawData: rows }) })
      if (!res.ok) { const err = await res.json(); addMessage('assistant', `Er ging iets mis: ${err.error}`); setChatState('idle'); extractingRef.current = false; return }
      const data: ExtractResult = await res.json()
      setPendingContacts(data.contacts)
      onContactsExtracted(data.contacts)

      // Het model schrijft dit bericht; de server controleert het op verzonnen
      // aantallen en levert anders de vaste tekst.
      addMessage('assistant', data.opener || deterministicOpener(data))
      setChatState(data.summary.valid > 0 ? 'awaiting_confirmation' : 'idle')
    } catch { addMessage('assistant', 'Kon het bestand niet analyseren. Probeer opnieuw.'); setChatState('idle') }
    finally { extractingRef.current = false }
  }

  function cancelSend() {
    addMessage('assistant', 'Goed, ik verstuur niets. Je kunt nog vragen stellen over de lijst, of hierboven een ander bestand kiezen.')
    setChatState('idle')
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

  /**
   * Een getypt bericht is altijd een vraag, nooit een opdracht.
   *
   * Hiervoor werd de tekst op trefwoorden bekeken, met `includes()`. Daarmee
   * zit "ok" in "ook" en "ja" in "jaar", dus "stuur hem ook naar Jan, maar niet
   * naar Piet" startte de verzending — naar iedereen. Een zin waarin je een
   * voorbehoud maakt hoort nooit honderden mails in gang te zetten. Bevestigen
   * gaat daarom uitsluitend via de knop.
   */
  async function handleUserMessage(text: string) {
    const question = text.trim()
    if (!question || answering) return

    addMessage('user', question)
    setInput('')
    setAnswering(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, contacts: pendingContacts }),
      })
      const data = await res.json()
      addMessage('assistant', res.ok ? data.answer : (data.error || 'Daar kwam ik even niet uit. Probeer het opnieuw.'))
    } catch {
      addMessage('assistant', 'Verbindingsfout. Probeer het opnieuw.')
    } finally {
      setAnswering(false)
    }
  }

  const renderContent = format

  const busy = chatState === 'extracting' || chatState === 'sending'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/*
        Geen kaart om het gesprek. Het gesprek ís de pagina; een rand eromheen
        voegde een doos toe binnen een doos en maakte het leeg gedeelte alleen
        zichtbaarder. Wat het samenhoudt is de leesbreedte, niet een lijn.
      */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto mt-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
          {messages.map((m, i) => {
            const laatste = i === messages.length - 1
            const eerste = i === 0

            if (m.role === 'user') {
              return (
                <p key={i} className="animate-rise-in self-end rounded-lg bg-navy px-4 py-2.5 text-base text-surface">
                  <span dangerouslySetInnerHTML={{ __html: renderContent(m.content) }} />
                </p>
              )
            }

            return (
              <div
                key={i}
                className={cn(
                  'animate-rise-in text-ink',
                  // Het eerste bericht is wat je moet lezen voordat je op een
                  // knop drukt die honderden mails verstuurt. Dat mag groter
                  // staan dan de antwoorden die erna komen.
                  eerste ? 'text-lg leading-relaxed' : 'text-base',
                )}
              >
                {laatste && !settled ? (
                  <Typewriter text={m.content} onDone={() => setSettled(true)} />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: renderContent(m.content) }} />
                )}
              </div>
            )
          })}

          {busy && (
            <p className="flex animate-rise-in items-center gap-2 text-base text-ink-muted">
              <Spinner />
              Bezig…
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* De bevestiging is de kern van het scherm en staat vast onderin, zodat
          hij niet met het gesprek wegscrolt. Hij verschijnt pas als het bericht
          is uitgetypt: je kunt niet bevestigen wat je nog niet hebt gelezen, en
          juist de waarschuwing over een verkeerd bestand staat in die tekst. */}
      <div
        className={cn(
          'shrink-0 border-t border-line bg-canvas transition-opacity duration-base ease-out',
          settled ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-5">
          {chatState === 'awaiting_confirmation' && (
            <div className="flex animate-rise-in gap-3">
              <Button onClick={runSend} disabled={!settled}>
                Ja, versturen
              </Button>
              <Button variant="secondary" onClick={cancelSend} disabled={!settled}>
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
              placeholder="Stel een vraag over de lijst…"
              disabled={busy || answering}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!input.trim() || busy || answering}
              className="shrink-0"
            >
              Vraag
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
