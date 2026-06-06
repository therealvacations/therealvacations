import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  const path = req.nextUrl.pathname

  if (['/my-trips', '/dashboard', '/profile', '/bookings'].some(p => path.startsWith(p)) && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (path.startsWith('/admin')) {
    if (!session) return NextResponse.redirect(new URL('/admin/login', req.url))
    const { data: admin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', session.user.id)
      .single()
    if (!admin) return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: ['/my-trips/:path*', '/dashboard/:path*', '/profile/:path*', '/bookings/:path*', '/admin/:path*']
}
