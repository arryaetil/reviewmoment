import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUsers, createToken, TOKEN_NAME, JWTPayload } from '@/lib/auth'
import { isRateLimited } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited('auth', ip, 5)) {
    return NextResponse.json(
      { error: 'Te veel inlogpogingen. Probeer over een minuut opnieuw.' },
      { status: 429 }
    )
  }

  const body = await req.json()
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'E-mail en wachtwoord zijn verplicht.' }, { status: 400 })
  }

  const users = getUsers()
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase())

  if (!user) {
    return NextResponse.json({ error: 'Ongeldige inloggegevens.' }, { status: 401 })
  }

  const passwordMatch = user.password.startsWith('$2')
    ? await bcrypt.compare(password, user.password)
    : password === user.password

  if (!passwordMatch) {
    return NextResponse.json({ error: 'Ongeldige inloggegevens.' }, { status: 401 })
  }

  const payload: JWTPayload = {
    email: user.email,
    businessName: user.businessName,
    googleReviewLink: user.googleReviewLink,
    fromDomain: user.fromDomain,
    fromName: user.fromName,
    replyTo: user.replyTo,
  }

  const token = await createToken(payload)

  const response = NextResponse.json({ success: true })
  response.cookies.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })

  return response
}
