export const dynamic = 'force-dynamic'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function TripsPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) redirect('/login?next=/admin/trips')
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()
  
  if (!profile?.is_admin) redirect('/')

  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .order('dates_start', { ascending: true })

  return (
    <div style={{padding:'40px',fontFamily:'DM Sans,sans-serif',background:'#0f0620',minHeight:'100vh',color:'#fff'}}>
      <a href="/admin" style={{color:'#a78bfa',textDecoration:'none',marginBottom:'24px',display:'block'}}>← Back to Dashboard</a>
      
      <h1 style={{fontSize:'28px',fontWeight:'800',marginBottom:'32px'}}>Manage Trips ({trips?.length || 0})</h1>
      
      <div style={{display:'grid',gap:'16px'}}>
        {trips?.map((t: any) => (
          <div key={t.trip_id} style={{background:'#1a0533',borderRadius:'16px',padding:'24px',display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid rgba(124,58,237,0.2)'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:'700',fontSize:'18px',color:'#fff'}}>{t.title}</div>
              <div style={{color:'#888',fontSize:'14px',marginTop:'8px'}}>{t.location} · {t.dates_start} → {t.dates_end}</div>
              <div style={{color:'#4ade80',fontSize:'14px',marginTop:'8px'}}>Cost: ${t.total_cost} · Spots: {t.max_spots}</div>
              <div style={{color:'#c084fc',fontSize:'13px',marginTop:'6px'}}>Deposit: ${t.deposit_amount}</div>
              <span style={{display:'inline-block',marginTop:'12px',background:t.status==='active'?'#166534':t.status==='sold_out'?'#7c2d12':'#4b5563',padding:'4px 12px',borderRadius:'20px',fontSize:'12px',fontWeight:'600'}}>
                {t.status}
              </span>
            </div>
            {t.stripe_product_id && (
              <a href={`https://dashboard.stripe.com/products/${t.stripe_product_id}`} target="_blank" style={{background:'#7c3aed',color:'#fff',padding:'10px 20px',borderRadius:'10px',fontWeight:'700',textDecoration:'none',fontSize:'14px',marginLeft:'20px',whiteSpace:'nowrap'}}>
                Stripe →
              </a>
            )}
          </div>
        ))}
        
        {(!trips || trips.length === 0) && (
          <div style={{background:'#1a0533',borderRadius:'16px',padding:'40px',textAlign:'center',color:'#666'}}>
            No trips yet
          </div>
        )}
      </div>
    </div>
  )
}
