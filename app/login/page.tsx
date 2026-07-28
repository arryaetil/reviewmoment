'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Field, Input, Notice, Spinner } from '@/components/ui'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Inloggen mislukt.')
        setLoading(false)
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('Verbindingsfout. Probeer opnieuw.')
      setLoading(false)
    }
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo.svg" alt="reviewmoment.nl" width={320} height={178} className="h-20 w-auto" />
          <h1 className="mt-8 text-xl font-medium">Inloggen</h1>
          <p className="mt-2 text-base text-ink-muted">
            Log in om reviewverzoeken te versturen.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <Field label="E-mailadres" htmlFor="email">
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                // Een e-mailadres is geen woord; de rode kringel eronder
                // suggereert een fout die er niet is.
                spellCheck={false}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jouw@bedrijf.nl"
                required
                autoFocus
              />
            </Field>

            <Field label="Wachtwoord" htmlFor="password">
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </Field>

            {error && <Notice tone="error">{error}</Notice>}

            {/* Bewust niet uitgeschakeld tot de velden gevuld zijn: een knop
                die niets doet zonder te zeggen waarom is erger dan een knop die
                een melding geeft. `required` doet dat werk. */}
            <Button type="submit" size="lg" disabled={loading}>
              {loading && <Spinner />}
              Inloggen
            </Button>
          </form>
        </Card>

        {/* De demo-knop met vaste inloggegevens is eruit: die zette een geldig
            wachtwoord in de client-bundle, zichtbaar voor iedereen die de
            pagina opvraagt. Prima voor een POC, niet voor productie. */}

        <p className="mt-6 text-center text-sm text-ink-subtle">reviewmoment.nl</p>
      </div>
    </div>
  )
}
