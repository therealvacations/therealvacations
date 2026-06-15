export const dynamic = 'force-dynamic'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function BookingsPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) redirect('/login?next=/admin/bookings')
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()
  
  if (!profile?.is_admin) redirect('/')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, trips(title, location)')
    .order('created_at', { ascending: false })

  return (
    <div style={{padding:'40px',fontFamily:'DM Sans,sans-serif',background:'#0f0620',minHeight:'100vh',color:'#fff'}}>
      <a href="/admin" style={{color:'#a78bfa',textDecoration:'none',marginBottom:'24px',display:'block'}}>← Back to Dashboard</a>
      
      <h1 style={{fontSize:'28px',fontWeight:'800',marginBottom:'32px'}}>All Bookings ({bookings?.length || 0})</h1>
      
      <div style={{background:'#1a0533',borderRadius:'16px',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid rgba(124,58,237,0.3)'}}>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>TRIP</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>LOCATION</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>DEPOSIT</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>TOTAL</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>PAID</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>BALANCE</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>STATUS</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>DATE</th>
            </tr>
          </thead>
          <tbody>
            {bookings?.map((b: any) => (
              <tr key={b.booking_id} style={{borderBottom:'1px solid rgba(255,255,255,0.05)',cursor:'pointer'}} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(124,58,237,0.1)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                <td style={{padding:'16px'}}>{b.trips?.title || '—'}</td>
                <td style={{padding:'16px',color:'#888'}}>{b.trips?.location || '—'}</td>
                <td style={{padding:'16px',color:'#4ade80'}}>${b.deposit_amount}</td>
                <td style={{padding:'16px'}}>${b.total_amount}</td>
                <td style={{padding:'16px',color:'#4ade80'}}>${b.amount_paid}</td>
                <td style={{padding:'16px',color:'#f87171'}}>${b.balance_due}</td>
                <td style={{padding:'16px'}}>
                  <span style={{background:b.status==='confirmed'?'#166534':b.status==='pending'?'#854d0e':'#7c3aed',padding:'4px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:'600'}}>
                    {b.status}
                  </span>
                </td>
                <td style={{padding:'16px',fontSize:'12px',color:'#666'}}>{new Date(b.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {(!bookings || bookings.length === 0) && (
          <div style={{padding:'40px',textAlign:'center',color:'#666'}}>
            <p>No bookings yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
