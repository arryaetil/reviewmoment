import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const { user, tenant } = session

  return NextResponse.json({
    email: user.email,
    role: user.role,
    businessName: tenant.businessName,
    googleReviewLink: tenant.googleReviewLink,
    sendingDomain: tenant.sendingDomain,
    domainStatus: tenant.domainStatus,
    fromName: tenant.fromName,
    replyTo: tenant.replyTo,
    monthlyEmailLimit: tenant.monthlyEmailLimit,
  })
}
