import { createMiddlewareClient } 
  from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = 
    await supabase.auth.getSession()

  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(
        new URL('/login?next=/admin', req.url)
      )
    }
  }
  return res
}

export const config = {
  matcher: ['/admin/:path*']
}
