import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, TOKEN_NAME } from '@/lib/auth'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/health',      // healthcheck van de hostingomgeving
  '/api/webhooks/',   // Resend-webhooks: eigen signature-verificatie
  '/api/jobs/process', // QStash-worker: eigen signature-verificatie
  '/u/',              // uitschrijflinks uit e-mails
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    // De logo's staan op het inlogscherm, dus vóór er een sessie is.
    pathname.startsWith('/logo')
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(TOKEN_NAME)?.value
  const isApi = pathname.startsWith('/api/')

  if (!token) {
    return isApi
      ? NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url))
  }

  const payload = await verifyToken(token)
  if (!payload) {
    if (isApi) {
      return NextResponse.json({ error: 'Sessie verlopen' }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL('/login', req.url))
    response.cookies.set(TOKEN_NAME, '', { maxAge: 0, path: '/' })
    return response
  }

  // Bewust géén x-user-* headers meer. De route handlers lezen de tenantconfig
  // zelf uit de database via getSession(); middleware doet alleen de poortwacht.
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
