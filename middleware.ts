import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, TOKEN_NAME } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/logo.png' ||
    pathname === '/logo-icon.png'
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(TOKEN_NAME)?.value

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const payload = await verifyToken(token)
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sessie verlopen' }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL('/login', req.url))
    response.cookies.set(TOKEN_NAME, '', { maxAge: 0, path: '/' })
    return response
  }

  const headers = new Headers(req.headers)
  headers.set('x-user-email', payload.email)
  headers.set('x-user-business-name', payload.businessName)
  headers.set('x-user-google-review-link', payload.googleReviewLink)
  headers.set('x-user-from-domain', payload.fromDomain)
  headers.set('x-user-from-name', payload.fromName)
  headers.set('x-user-reply-to', payload.replyTo)

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
