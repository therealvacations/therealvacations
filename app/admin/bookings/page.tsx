import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function BookingsPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login.html?next=/admin/bookings')

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', session.user.id).single()
  if (!profile?.is_admin) redirect('/')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{padding:'40px',fontFamily:'DM Sans,sans-serif',background:'#0f0620',minHeight:'100vh',color:'#fff'}}>
      <a href="/admin" style={{color:'#a78bfa',textDecoration:'none',marginBottom:'24px',display:'block'}}>← Back to Dashboard</a>
      <h1 style={{fontSize:'28px',fontWeight:'800',marginBottom:'32px'}}>All Bookings</h1>
      <div style={{background:'#1a0533',borderRadius:'16px',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid rgba(124,58,237,0.3)'}}>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>ID</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>TRIP</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>TIER</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>DEPOSIT</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>STATUS</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>DATE</th>
            </tr>
          </thead>
          <tbody>
            {bookings?.map((b) => (
              <tr key={b.id} style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                <td style={{padding:'16px',fontSize:'12px',color:'#666'}}>{b.id?.slice(0,8)}...</td>
                <td style={{padding:'16px'}}>{b.trip_id?.slice(0,8)}...</td>
                <td style={{padding:'16px'}}>{b.tier}</td>
                <td style={{padding:'16px',color:'#4ade80'}}>${b.deposit_paid}</td>
                <td style={{padding:'16px'}}>
                  <span style={{background: b.status === 'confirmed' ? '#166534' : '#854d0e',padding:'4px 10px',borderRadius:'20px',fontSize:'12px'}}>
                    {b.status}
                  </span>
                </td>
                <td style={{padding:'16px',fontSize:'12px',color:'#666'}}>{new Date(b.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!bookings || bookings.length === 0) && (
          <div style={{padding:'40px',textAlign:'center',color:'#666'}}>No bookings yet</div>
        )}
      </div>
    </div>
  )
}
