import { createServerComponentClient } 
  from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = 
    await supabase.auth.getSession()

  if (!session) redirect('/login?next=/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  return (
    <div style={{padding: '40px'}}>
      <h1>Admin Dashboard</h1>
      <p>Welcome back, {session.user.email}</p>
    </div>
  )
}
