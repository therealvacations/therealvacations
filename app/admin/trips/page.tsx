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
    .order('date', { ascending: true })

  return (
    <div style={{padding:'40px',fontFamily:'DM Sans,sans-serif',background:'#0f0620',minHeight:'100vh',color:'#fff'}}>
      <a href="/admin" style={{color:'#a78bfa',textDecoration:'none',marginBottom:'24px',display:'block'}}>← Back to Dashboard</a>
      <h1 style={{fontSize:'28px',fontWeight:'800',marginBottom:'32px'}}>Manage Trips</h1>
      <div style={{display:'grid',gap:'16px'}}>
        {trips?.map((t) => (
          <div key={t.id} style={{background:'#1a0533',borderRadius:'16px',padding:'24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:'700',fontSize:'18px'}}>{t.name}</div>
              <div style={{color:'#666',fontSize:'14px',marginTop:'4px'}}>{t.location} · {t.date}</div>
              <div style={{color:'#4ade80',fontSize:'14px',marginTop:'4px'}}>General: ${t.price_general} · VIP: ${t.price_vip}</div>
            </div>
            {t.stripe_link && (
              <a href={t.stripe_link} target="_blank" style={{background:'#7c3aed',color:'#fff',padding:'10px 20px',borderRadius:'10px',fontWeight:'700',textDecoration:'none',fontSize:'14px'}}>
                Stripe Link →
              </a>
            )}
          </div>
        ))}
        {(!trips || trips.length === 0) && (
          <div style={{background:'#1a0533',borderRadius:'16px',padding:'40px',textAlign:'center',color:'#666'}}>No trips yet</div>
        )}
      </div>
    </div>
  )
}
