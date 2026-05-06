// pages/admin/dashboard.tsx
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
    // Fetch customer accounts
    supabase
      .from('customers') // Your customers table
      .select('*')
      .then(({ data }) => {
        setCustomers(data || []);
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/admin-login');
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Delete this customer?')) return;
    
    await supabase
      .from('customers')
      .delete()
      .eq('id', customerId);
    
    setCustomers(customers.filter((c) => c.id !== customerId));
  };

  const handleUpdateCustomer = async (customerId: string, updates: any) => {
    await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId);
    
    setCustomers(customers.map((c) => (c.id === customerId ? { ...c, ...updates } : c)));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600">{user?.email}</p>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <a href="/admin/dashboard" className="px-4 py-2 border-b-2 border-blue-600 font-semibold">Customers</a>
          <a href="/admin/content" className="px-4 py-2 text-gray-600 hover:text-gray-900">Content</a>
          <a href="/admin/settings" className="px-4 py-2 text-gray-600 hover:text-gray-900">Settings</a>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Customer Accounts ({customers.length})</h2>
            
            {loading ? (
              <p>Loading...</p>
            ) : customers.length === 0 ? (
              <p className="text-gray-600">No customers yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold">Joined</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">{customer.name}</td>
                        <td className="px-6 py-4">{customer.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded text-sm ${customer.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {customer.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{new Date(customer.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 space-x-2">
                          <button
                            onClick={() => handleUpdateCustomer(customer.id, { active: !customer.active })}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {customer.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="text-red-600 hover:underline text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(AdminDashboard);

// pages/admin/content.tsx
'use client';
import { withAuth } from '@/lib/withAuth';
import supabase from '@/lib/supabase-integration';
import { useState } from 'react';

function ContentManager({ user }: { user: any }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePublish = async (table: string) => {
    setLoading(true);
    await supabase.from(table).insert([{ title, content }]);
    setTitle('');
    setContent('');
    setLoading(false);
    alert('Published!');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Manage Content</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block font-semibold mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg p-3"
            />
          </div>
          
          <div>
            <label className="block font-semibold mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full border rounded-lg p-3"
              rows={8}
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handlePublish('blog_posts')}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Publish to Blog
            </button>
            <button
              onClick={() => handlePublish('pages')}
              disabled={loading}
              className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
            >
              Publish as Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(ContentManager);
