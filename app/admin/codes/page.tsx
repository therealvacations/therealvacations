import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function CodesPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login?next=/admin/codes')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()
  if (!profile?.is_admin) redirect('/')

  const { data: codes } = await supabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{padding:'40px',fontFamily:'DM Sans,sans-serif',background:'#0f0620',minHeight:'100vh',color:'#fff'}}>
      <a href="/admin" style={{color:'#a78bfa',textDecoration:'none',marginBottom:'24px',display:'block'}}>← Back to Dashboard</a>
      <h1 style={{fontSize:'28px',fontWeight:'800',marginBottom:'32px'}}>Promo Codes</h1>
      <div style={{background:'#1a0533',borderRadius:'16px',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid rgba(124,58,237,0.3)'}}>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>CODE</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>DISCOUNT</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>EMAIL</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>USED</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>EXPIRES</th>
            </tr>
          </thead>
          <tbody>
            {codes?.map((c) => (
              <tr key={c.id} style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                <td style={{padding:'16px',fontWeight:'700',color:'#a78bfa'}}>{c.code}</td>
                <td style={{padding:'16px',color:'#4ade80'}}>${c.discount_amount} off</td>
                <td style={{padding:'16px',fontSize:'13px'}}>{c.user_email || '—'}</td>
                <td style={{padding:'16px'}}>
                  <span style={{background:c.used?'#166534':'#1a0533',border:'1px solid',borderColor:c.used?'#166534':'#7c3aed',padding:'4px 10px',borderRadius:'20px',fontSize:'12px'}}>
                    {c.used ? 'Used' : 'Active'}
                  </span>
                </td>
                <td style={{padding:'16px',fontSize:'12px',color:'#666'}}>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!codes || codes.length === 0) && (
          <div style={{padding:'40px',textAlign:'center',color:'#666'}}>No promo codes yet</div>
        )}
      </div>
    </div>
  )
}
