import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { refreshDomainStatus } from '@/lib/provisioning/domain'

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
