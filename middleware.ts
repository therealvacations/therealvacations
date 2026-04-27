import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const token = req.cookies.get('sb-lqdflvnkiskzmvvknmmh-auth-token')
    if (!token) {
      return NextResponse.redirect(
        new URL('/login?next=/admin', req.url)
      )
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
