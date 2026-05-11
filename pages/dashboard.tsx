'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withAuth } from '@/lib/withAuth';
import { auth } from '@/lib/auth';
import supabase from '@/lib/supabase-integration';

function AdminDashboard({ user }: { user: any }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.from('customers').select('*').then(({ data }) => {
      setCustomers(data || []);
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/admin-login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600">{user?.email}</p>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Logout</button>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Customers ({customers.length})</h2>
          {loading ? <p>Loading...</p> : customers.length === 0 ? <p>No customers yet</p> : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="px-6 py-4">{c.name}</td>
                    <td className="px-6 py-4">{c.email}</td>
                    <td className="px-6 py-4 text-sm">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default withAuth(AdminDashboard);
