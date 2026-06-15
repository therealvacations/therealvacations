export const dynamic = 'force-dynamic'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function CustomersPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) redirect('/login?next=/admin/customers')
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()
  
  if (!profile?.is_admin) redirect('/')

  const { data: customers } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{padding:'40px',fontFamily:'DM Sans,sans-serif',background:'#0f0620',minHeight:'100vh',color:'#fff'}}>
      <a href="/admin" style={{color:'#a78bfa',textDecoration:'none',marginBottom:'24px',display:'block'}}>← Back to Dashboard</a>
      
      <h1 style={{fontSize:'28px',fontWeight:'800',marginBottom:'32px'}}>All Customers ({customers?.length || 0})</h1>
      
      <div style={{background:'#1a0533',borderRadius:'16px',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid rgba(124,58,237,0.3)'}}>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>NAME</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>EMAIL</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>ADMIN</th>
              <th style={{padding:'16px',textAlign:'left',color:'#a78bfa',fontSize:'13px'}}>JOINED</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c: any) => (
              <tr key={c.id} style={{borderBottom:'1px solid rgba(255,255,255,0.05)',cursor:'pointer'}} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(124,58,237,0.1)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                <td style={{padding:'16px'}}>{c.full_name || '—'}</td>
                <td style={{padding:'16px',color:'#a78bfa'}}>{c.email || '—'}</td>
                <td style={{padding:'16px'}}>
                  {c.is_admin ? <span style={{background:'#7c3aed',color:'#fff',padding:'4px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:'600'}}>Admin</span> : '—'}
                </td>
                <td style={{padding:'16px',fontSize:'12px',color:'#666'}}>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {(!customers || customers.length === 0) && (
          <div style={{padding:'40px',textAlign:'center',color:'#666'}}>
            No customers yet
          </div>
        )}
      </div>
    </div>
  )
}
