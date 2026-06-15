export const dynamic = 'force-dynamic'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) redirect('/login?next=/admin')
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()
  
  if (!profile?.is_admin) redirect('/')

  // Fetch all data
  const [
    { data: bookings },
    { data: trips },
    { data: customers },
  ] = await Promise.all([
    supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('trips').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
  ])

  // Calculate stats
  const totalRevenue = (bookings || []).reduce((sum: number, b: any) => sum + (b.amount_paid || 0), 0)
  const confirmedBookings = (bookings || []).filter((b: any) => b.status === 'confirmed').length
  const pendingBookings = (bookings || []).filter((b: any) => b.status === 'pending').length
  const activeTrips = (trips || []).filter((t: any) => t.status === 'active').length
  const totalBookings = bookings?.length || 0
  const totalCustomers = customers?.length || 0

  return (
    <div style={{padding:'40px',fontFamily:'DM Sans,sans-serif',background:'#0f0620',minHeight:'100vh',color:'#fff'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'40px'}}>
        <h1 style={{fontSize:'32px',fontWeight:'800'}}>Admin Dashboard</h1>
        <a href="/login" style={{color:'#f87171',textDecoration:'none',fontSize:'14px',fontWeight:'600'}}>Logout</a>
      </div>

      {/* Stats Grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'16px',marginBottom:'40px'}}>
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, color: '#4ade80' },
          { label: 'Confirmed Bookings', value: confirmedBookings, color: '#7c3aed' },
          { label: 'Pending Bookings', value: pendingBookings, color: '#fbbf24' },
          { label: 'Active Trips', value: activeTrips, color: '#60a5fa' },
          { label: 'Total Bookings', value: totalBookings, color: '#a78bfa' },
          { label: 'Total Customers', value: totalCustomers, color: '#f472b6' },
        ].map((stat) => (
          <div key={stat.label} style={{background:'#1a0533',borderRadius:'16px',padding:'24px',border:'1px solid rgba(124,58,237,0.2)'}}>
            <p style={{color:'#888',fontSize:'13px',marginBottom:'8px'}}>{stat.label}</p>
            <p style={{fontSize:'28px',fontWeight:'800',color:stat.color}}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Navigation Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'16px',marginBottom:'40px'}}>
        {[
          { label: 'Manage Bookings', href: '/admin/bookings', icon: '📋' },
          { label: 'Manage Trips', href: '/admin/trips', icon: '✈️' },
          { label: 'Manage Customers', href: '/admin/customers', icon: '👥' },
        ].map((link) => (
          <a key={link.href} href={link.href} style={{background:'linear-gradient(135deg, #7c3aed, #6d28d9)',borderRadius:'16px',padding:'24px',textDecoration:'none',color:'#fff',display:'block',transition:'all 0.2s',cursor:'pointer'}} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseOut={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed, #6d28d9)',e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{fontSize:'28px',marginBottom:'12px'}}>{link.icon}</div>
            <p style={{fontWeight:'700',fontSize:'16px'}}>{link.label}</p>
          </a>
        ))}
      </div>

      {/* Recent Bookings Table */}
      <div style={{background:'#1a0533',borderRadius:'16px',overflow:'hidden',border:'1px solid rgba(124,58,237,0.2)'}}>
        <div style={{padding:'24px',borderBottom:'1px solid rgba(124,58,237,0.2)'}}>
          <h2 style={{fontSize:'18px',fontWeight:'700'}}>Recent Bookings</h2>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid rgba(124,58,237,0.3)'}}>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>ID</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>DEPOSIT</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>TOTAL</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>PAID</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>STATUS</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>DATE</th>
            </tr>
          </thead>
          <tbody>
            {bookings?.map((b: any) => (
              <tr key={b.booking_id} style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                <td style={{padding:'16px',fontSize:'12px',color:'#666'}}>{b.booking_id?.toString().slice(0,8)}...</td>
                <td style={{padding:'16px',color:'#4ade80'}}>${b.deposit_amount}</td>
                <td style={{padding:'16px'}}>${b.total_amount}</td>
                <td style={{padding:'16px',color:'#4ade80'}}>${b.amount_paid}</td>
                <td style={{padding:'16px'}}>
                  <span style={{background:b.status==='confirmed'?'#166534':'#854d0e',padding:'4px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:'600'}}>
                    {b.status}
                  </span>
                </td>
                <td style={{padding:'16px',fontSize:'12px',color:'#666'}}>{new Date(b.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{padding:'16px',textAlign:'center',borderTop:'1px solid rgba(124,58,237,0.2)'}}>
          <a href="/admin/bookings" style={{color:'#7c3aed',textDecoration:'none',fontSize:'14px',fontWeight:'600'}}>View all bookings →</a>
        </div>
      </div>
    </div>
  )
}
