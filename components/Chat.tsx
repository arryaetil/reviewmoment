'use client'

import { useState, useEffect, useRef } from 'react'
import { ChatMessage, Contact, ExtractResult, RawRow, SendResult } from '@/lib/types'

interface Props {
  uploadTrigger: RawRow[] | null
  onContactsExtracted: (contacts: Contact[]) => void
}

type State = 'idle' | 'extracting' | 'awaiting_confirmation' | 'sending' | 'done'

function CloudyAvatar() {
  return (
    <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: '-6px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,.25) 0%, transparent 70%)',
        animation: 'pulse-glow 2.5s ease-in-out infinite',
      }} />
      <div style={{
        width: '46px', height: '46px', borderRadius: '50%',
        background: 'linear-gradient(160deg, #dde8ff 0%, #b8caff 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        boxShadow: '0 0 0 2px rgba(255,255,255,.4), 0 4px 14px rgba(0,0,0,.2)',
        animation: 'float 3.5s ease-in-out infinite',
      }}>
        <div style={{ position: 'absolute', top: '-4px', left: '5px', right: '5px', height: '5px', border: '2.5px solid rgba(180,200,255,.8)', borderBottom: 'none', borderRadius: '10px 10px 0 0' }} />
        <div style={{ position: 'absolute', top: '10px', left: '-3px', width: '5px', height: '11px', borderRadius: '3px', background: 'linear-gradient(180deg, #4a7fff, #1a44e8)', boxShadow: '0 0 6px rgba(26,68,232,.5)' }} />
        <div style={{ position: 'absolute', top: '10px', right: '-3px', width: '5px', height: '11px', borderRadius: '3px', background: 'linear-gradient(180deg, #4a7fff, #1a44e8)', boxShadow: '0 0 6px rgba(26,68,232,.5)' }} />
        <div style={{
          width: '32px', height: '24px', borderRadius: '8px', background: '#08101f',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
          boxShadow: 'inset 0 0 8px rgba(26,68,232,.5), 0 0 0 1.5px rgba(100,140,255,.4)',
        }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <div style={{ width: '6px', height: '4px', borderRadius: '50%', background: '#1a44e8', boxShadow: '0 0 5px rgba(26,68,232,.9)', animation: 'blink 4s ease-in-out infinite' }} />
            <div style={{ width: '6px', height: '4px', borderRadius: '50%', background: '#1a44e8', boxShadow: '0 0 5px rgba(26,68,232,.9)', animation: 'blink 4s ease-in-out infinite .08s' }} />
          </div>
          <div style={{ width: '11px', height: '3px', borderBottom: '2px solid #1a44e8', borderRadius: '0 0 5px 5px', boxShadow: '0 0 5px rgba(26,68,232,.7)' }} />
        </div>
        <div style={{ position: 'absolute', bottom: '5px', left: '50%', transform: 'translateX(-50%)', fontSize: '7px', color: 'rgba(26,68,232,.5)', lineHeight: 1 }}>☁</div>
      </div>
    </div>
  )
}

function BubbleAvatar({ role }: { role: 'ai' | 'user' }) {
  return (
    <div style={{
      width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '9px', fontWeight: 700, marginBottom: '2px',
      ...(role === 'ai'
        ? { background: 'linear-gradient(135deg, #1a44e8, #4a7fff)', color: 'white' }
        : { background: 'rgba(26,68,232,.08)', color: '#1a44e8' }
      ),
    }}>
      {role === 'ai' ? 'C' : 'JIJ'}
    </div>
  )
}

export default function Chat({ uploadTrigger, onContactsExtracted }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: 'Hoi! Ik ben Cloudy, je digitale assistent. Ik analyseer je bestand...',
    timestamp: new Date(),
  }])
  const [input, setInput] = useState('')
  const [chatState, setChatState] = useState<State>('idle')
  const [pendingContacts, setPendingContacts] = useState<Contact[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const extractingRef = useRef(false)
  const lastTriggerRef = useRef<RawRow[] | null>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!uploadTrigger || uploadTrigger.length === 0) return
    if (uploadTrigger === lastTriggerRef.current) return
    if (extractingRef.current) return
    lastTriggerRef.current = uploadTrigger
    runExtract(uploadTrigger)
  }, [uploadTrigger])

  function addMessage(role: 'user' | 'assistant', content: string) {
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

      const valid = data.contacts.filter(c => c.valid)
      const invalid = data.summary.invalid
      let msg = `Ik heb ${data.summary.valid} geldige e-mailadressen gevonden.`
      if (invalid > 0) msg += ` ${invalid} ${invalid === 1 ? 'adres' : 'adressen'} overgeslagen (ongeldig).`

      if (valid.length > 0) {
        msg += '\n\nVoorbeeld van de e-mail die verstuurd wordt:'
        msg += '\n────────────────────'
        msg += `\nOnderwerp: Bedankt voor uw bezoek`
        msg += `\n\nHallo ${valid[0].name || 'klant'},`
        msg += '\nBedankt dat u voor ons heeft gekozen. Zou u een korte Google Review willen achterlaten?'
        msg += '\n[Review achterlaten] (link)'
        msg += '\n────────────────────'
        msg += `\n\nWil je dat ik ${data.summary.valid} reviewverzoeken verstuur?`
      }

      addMessage('assistant', msg)
      setChatState('awaiting_confirmation')
    } catch { addMessage('assistant', 'Kon het bestand niet analyseren. Probeer opnieuw.'); setChatState('idle') }
    finally { extractingRef.current = false }
  }

  async function runSend() {
    setChatState('sending')
    addMessage('assistant', 'Bezig met versturen...')
    const valid = pendingContacts.filter(c => c.valid)
    try {
      const res = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contacts: valid }) })
      const data: SendResult = await res.json()
      if (!res.ok) { addMessage('assistant', 'Er ging iets mis bij het versturen. Probeer opnieuw.'); setChatState('awaiting_confirmation'); return }

      let msg = ''
      if (data.failed === 0) {
        msg = `Klaar! Alle ${data.sent} reviewverzoeken zijn succesvol verstuurd.`
      } else {
        msg = `${data.sent} van ${data.sent + data.failed} e-mails verstuurd. ${data.failed} mislukt.`
      }
      msg += '\n\nJe kunt een nieuw bestand uploaden om opnieuw te beginnen.'

      addMessage('assistant', msg)
      setChatState('done')
    } catch { addMessage('assistant', 'Verbindingsfout. Probeer opnieuw.'); setChatState('awaiting_confirmation') }
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

  const renderContent = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.45)', borderRadius: '20px', overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(26,68,232,0.06), 0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.6)',
    }}>
      {/* Cloudy Header */}
      <div style={{
        display: 'flex', alignItems: 'center', flexShrink: 0, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #1a44e8 0%, #3a5ff5 50%, #5b7aff 100%)',
        padding: '16px 20px', gap: '14px', borderRadius: '20px 20px 0 0',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 40%, rgba(255,255,255,.12) 0%, transparent 60%)' }} />
        <CloudyAvatar />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'white', marginBottom: '2px' }}>Cloudy</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)' }}>Je digitale assistent</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,.65)', marginTop: '2px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px rgba(74,222,128,.7)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            Online
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '18px 18px 6px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <BubbleAvatar role={m.role === 'user' ? 'user' : 'ai'} />
            <div style={{
              maxWidth: '80%', padding: '10px 14px', fontSize: '13.5px', lineHeight: 1.55,
              ...(m.role === 'user' ? {
                background: 'linear-gradient(135deg, #1a44e8, #3a5ff5)', color: 'white',
                borderRadius: '16px 16px 4px 16px',
              } : {
                background: 'rgba(255,255,255,0.7)', color: '#1a1f36',
                borderRadius: '16px 16px 16px 4px',
                border: '1px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
              }),
            }} dangerouslySetInnerHTML={{ __html: renderContent(m.content) }} />
          </div>
        ))}

        {/* Quick reply buttons */}
        {chatState === 'awaiting_confirmation' && (
          <div style={{ display: 'flex', gap: '8px', paddingLeft: '34px' }}>
            <button onClick={() => handleUserMessage('ja')} style={{
              padding: '8px 18px', color: 'white', fontSize: '13px', fontWeight: 500,
              borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: 'linear-gradient(135deg, #1a44e8, #3a5ff5)',
              boxShadow: '0 4px 14px rgba(26,68,232,.3), inset 0 1px 0 rgba(255,255,255,.15)',
            }}>
              Ja, versturen
            </button>
            <button onClick={() => handleUserMessage('nee')} style={{
              padding: '8px 18px', fontSize: '13px', fontWeight: 500,
              borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
              background: 'rgba(255,255,255,0.6)', color: '#6b7280',
              border: '1px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)',
            }}>
              Nee, stoppen
            </button>
          </div>
        )}

        {/* Typing indicator */}
        {(chatState === 'extracting' || chatState === 'sending') && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <BubbleAvatar role="ai" />
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(26,68,232,0.06)', padding: '12px 14px',
              borderRadius: '16px 16px 16px 4px', border: '1px solid rgba(26,68,232,0.08)',
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1a44e8', display: 'block', animation: `bounce-dot .9s infinite ${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: '10px',
        padding: '12px 16px 16px',
        borderTop: '1px solid rgba(255,255,255,0.3)',
        background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(12px)',
      }}>
        <form onSubmit={e => { e.preventDefault(); handleUserMessage(input) }} style={{ display: 'flex', flex: 1, gap: '10px' }}>
          <input
            type="text" value={input} onChange={e => setInput(e.target.value)}
            placeholder={
              chatState === 'awaiting_confirmation' ? 'Typ "ja" om te versturen of stel een vraag...'
              : chatState === 'done' ? 'Upload een nieuw bestand om opnieuw te beginnen'
              : 'Typ je antwoord...'
            }
            disabled={chatState === 'extracting' || chatState === 'sending'}
            style={{
              flex: 1, height: '44px', borderRadius: '14px', padding: '0 16px',
              fontSize: '13.5px', fontFamily: 'inherit', color: '#1a1f36', outline: 'none',
              background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)',
              border: '1.5px solid rgba(255,255,255,0.4)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
            }}
          />
          <button type="submit"
            disabled={!input.trim() || chatState === 'extracting' || chatState === 'sending'}
            style={{
              width: '44px', height: '44px', borderRadius: '14px', border: 'none', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: (!input.trim() || chatState === 'extracting' || chatState === 'sending') ? 'not-allowed' : 'pointer',
              ...( (!input.trim() || chatState === 'extracting' || chatState === 'sending')
                ? { background: 'rgba(107,114,128,0.3)' }
                : { background: 'linear-gradient(135deg, #1a44e8, #3a5ff5)', boxShadow: '0 4px 14px rgba(26,68,232,.3)' }
              ),
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
