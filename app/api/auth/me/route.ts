import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, TOKEN_NAME } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(TOKEN_NAME)?.value
  if (!token) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Sessie verlopen' }, { status: 401 })
  }

  return NextResponse.json({
    email: payload.email,
    businessName: payload.businessName,
    googleReviewLink: payload.googleReviewLink,
    fromDomain: payload.fromDomain,
    fromName: payload.fromName,
    replyTo: payload.replyTo,
  })
}
