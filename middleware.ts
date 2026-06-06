import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const path = req.nextUrl.pathname

  // Check for supabase auth cookie
  const token = req.cookies.get('sb-access-token')?.value ||
    req.cookies.get('sb-lqdflvnkiskzmvvknmmh-auth-token')?.value

  const userRoutes = ['/my-trips', '/dashboard', '/profile', '/bookings']
  const adminRoutes = ['/admin']

  if (userRoutes.some(p => path.startsWith(p)) && !token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (adminRoutes.some(p => path.startsWith(p)) && !token) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/my-trips/:path*', '/dashboard/:path*', '/profile/:path*', '/bookings/:path*', '/admin/:path*']
}
