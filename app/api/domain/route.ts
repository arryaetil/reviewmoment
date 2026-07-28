import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { provisionSendingDomain, refreshDomainStatus } from '@/lib/provisioning/domain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Huidige verificatiestatus van het verzenddomein, live opgehaald bij Resend. */
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const status = await refreshDomainStatus(session.tenant.id)
    return NextResponse.json({
      sendingDomain: session.tenant.sendingDomain,
      status,
    })
  } catch (err) {
    console.error('[domain] statuscontrole mislukt', err instanceof Error ? err.message : '')
    return NextResponse.json(
      { sendingDomain: session.tenant.sendingDomain, status: session.tenant.domainStatus },
      { status: 200 }
    )
  }
}

/**
 * Provisioning opnieuw draaien.
 *
 * Bij het aanmaken van een klant mag provisioning falen zonder de klant kwijt
 * te raken — een storing bij Resend of de DNS-provider hoort geen onboarding te
 * blokkeren. Maar zonder deze route was er daarna geen enkele manier om het
 * alsnog af te maken, en bleef de klant op 'pending' staan.
 *
 * Veilig om te herhalen: een bestaand Resend-domein wordt opgezocht in plaats
 * van opnieuw aangemaakt, en DNS-records worden ge-upsert.
 */
export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  if (session.tenant.domainStatus === 'verified') {
    return NextResponse.json({
      sendingDomain: session.tenant.sendingDomain,
      status: 'verified',
    })
  }

  try {
    const result = await provisionSendingDomain(session.tenant.id)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'onbekende fout'
    console.error(`[domain] provisioning mislukt voor tenant=${session.tenant.id}`, message)
    return NextResponse.json(
      { sendingDomain: session.tenant.sendingDomain, status: session.tenant.domainStatus, error: message },
      { status: 502 }
    )
  }
}
