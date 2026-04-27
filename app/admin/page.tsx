import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login.html?next=/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  const { count: bookingCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact' })

  const { count: customerCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })

  return (
    <div style={{padding:'40px',fontFamily:'DM Sans,sans-serif',background:'#0f0620',minHeight:'100vh',color:'#fff'}}>
      <h1 style={{fontSize:'32px',fontWeight:'800',marginBottom:'8px'}}>Admin Dashboard</h1>
      <p style={{color:'#a78bfa',marginBottom:'40px'}}>Welcome back, {session.user.email}</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'24px',marginBottom:'40px'}}>
        <div style={{background:'#1a0533',borderRadius:'16px',padding:'28px'}}>
          <div style={{fontSize:'36px',fontWeight:'800',color:'#a78bfa'}}>{bookingCount || 0}</div>
          <div style={{color:'#666',marginTop:'4px'}}>Total Bookings</div>
        </div>
        <div style={{background:'#1a0533',borderRadius:'16px',padding:'28px'}}>
          <div style={{fontSize:'36px',fontWeight:'800',color:'#a78bfa'}}>{customerCount || 0}</div>
          <div style={{color:'#666',marginTop:'4px'}}>Total Customers</div>
        </div>
        <div style={{background:'#1a0533',borderRadius:'16px',padding:'28px'}}>
          <div style={{fontSize:'36px',fontWeight:'800',color:'#4ade80'}}>Live</div>
          <div style={{color:'#666',marginTop:'4px'}}>Site Status</div>
        </div>
      </div>
      <div style={{display:'flex',gap:'16px',flexWrap:'wrap'}}>
        <a href="/admin/bookings" style={{background:'#7c3aed',color:'#fff',padding:'14px 24px',borderRadius:'10px',fontWeight:'700',textDecoration:'none'}}>View Bookings</a>
        <a href="/admin/customers" style={{background:'#1a0533',color:'#fff',padding:'14px 24px',borderRadius:'10px',fontWeight:'700',textDecoration:'none',border:'1px solid #7c3aed'}}>View Customers</a>
        <a href="/admin/trips" style={{background:'#1a0533',color:'#fff',padding:'14px 24px',borderRadius:'10px',fontWeight:'700',textDecoration:'none',border:'1px solid #7c3aed'}}>Manage Trips</a>
        <a href="/admin/codes" style={{background:'#1a0533',color:'#fff',padding:'14px 24px',borderRadius:'10px',fontWeight:'700',textDecoration:'none',border:'1px solid #7c3aed'}}>Promo Codes</a>
      </div>
    </div>
  )
}
