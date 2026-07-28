'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Typt tekst letter voor letter uit.
 *
 * De tekst staat al klaar zodra het bestand verwerkt is, dus dit hoeft niet via
 * de server te streamen — dat zou een hoop machinerie opleveren voor hetzelfde
 * resultaat. Het uittypen is er niet als versiering: het houdt de knoppen weg
 * tot het bericht gelezen kan zijn, zodat niemand op "versturen" drukt vóór hij
 * de waarschuwing heeft gezien.
 *
 * Geeft `done` terug zodat de aanroeper weet wanneer de knoppen mogen komen.
 */
export function useTypewriter(text: string, charsPerTick = 2, tickMs = 16) {
  const [shown, setShown] = useState('')
  const frame = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setShown('')
    if (!text) return

    let i = 0
    frame.current = setInterval(() => {
      i += charsPerTick
      setShown(text.slice(0, i))
      if (i >= text.length && frame.current) {
        clearInterval(frame.current)
        frame.current = null
      }
    }, tickMs)

    return () => {
      if (frame.current) clearInterval(frame.current)
    }
  }, [text, charsPerTick, tickMs])

  return { shown, done: shown.length >= text.length }
}

/**
 * Respecteert de systeeminstelling voor minder beweging. Wie dat aan heeft
 * staan krijgt de tekst in één keer; uittypen is dan hinder, geen hulp.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
