'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withAuth } from '../lib/withAuth';
import { auth } from '../lib/auth';
import supabase from '../lib/supabase-integration';

function AdminDashboard({ user }: { user: any }) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const router = useRouter();

  useEffect(() => {
    const fetchAll = async () => {
      const [profilesRes, bookingsRes, tripsRes, subscribersRes, contactsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*, trips(title, location, dates_start)').order('created_at', { ascending: false }),
        supabase.from('trips').select('*').order('dates_start', { ascending: true }),
        supabase.from('subscribers').select('*').order('created_at', { ascending: false }),
        supabase.from('contact_submissions').select('*').order('created_at', { ascending: false }),
      ]);
      setProfiles(profilesRes.data || []);
      setBookings(bookingsRes.data || []);
      setTrips(tripsRes.data || []);
      setSubscribers(subscribersRes.data || []);
      setContacts(contactsRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/admin-login');
  };

  const totalRevenue = bookings.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const activeTrips = trips.filter(t => t.status === 'active').length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-500 text-lg">Loading dashboard...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-800">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600">{user?.email}</p>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm">Logout</button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-6 border-t">
          {['overview', 'bookings', 'trips', 'customers', 'subscribers', 'contacts'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab ? 'border-purple-700 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, color: 'text-green-600' },
                { label: 'Confirmed Bookings', value: confirmedBookings, color: 'text-purple-600' },
                { label: 'Pending Bookings', value: pendingBookings, color: 'text-yellow-600' },
                { label: 'Active Trips', value: activeTrips, color: 'text-blue-600' },
                { label: 'Total Customers', value: profiles.length, color: 'text-gray-800' },
                { label: 'Subscribers', value: subscribers.length, color: 'text-pink-600' },
                { label: 'Contact Inquiries', value: contacts.length, color: 'text-orange-600' },
                { label: 'Total Bookings', value: bookings.length, color: 'text-indigo-600' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl shadow p-5">
                  <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-bold mb-4">Recent Bookings</h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Trip</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Total</th>
                    <th className="px-4 py-3 text-left font-semibold">Paid</th>
                    <th className="px-4 py-3 text-left font-semibold">Balance</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookings.slice(0, 5).map((b) => (
                    <tr key={b.booking_id}>
                      <td className="px-4 py-3">{b.trips?.title || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          b.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{b.status}</span>
                      </td>
                      <td className="px-4 py-3">${b.total_amount}</td>
                      <td className="px-4 py-3 text-green-600">${b.amount_paid}</td>
                      <td className="px-4 py-3 text-red-500">${b.balance_due}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(b.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {activeTab === 'bookings' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-bold mb-4">All Bookings ({bookings.length})</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Trip</th>
                  <th className="px-4 py-3 text-left font-semibold">Location</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Total</th>
                  <th className="px-4 py-3 text-left font-semibold">Paid</th>
                  <th className="px-4 py-3 text-left font-semibold">Balance</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bookings.map((b) => (
                  <tr key={b.booking_id}>
                    <td className="px-4 py-3 font-medium">{b.trips?.title || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{b.trips?.location || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        b.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{b.status}</span>
                    </td>
                    <td className="px-4 py-3">${b.total_amount}</td>
                    <td className="px-4 py-3 text-green-600">${b.amount_paid}</td>
                    <td className="px-4 py-3 text-red-500">${b.balance_due}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(b.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TRIPS */}
        {activeTab === 'trips' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-bold mb-4">All Trips ({trips.length})</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Title</th>
                  <th className="px-4 py-3 text-left font-semibold">Location</th>
                  <th className="px-4 py-3 text-left font-semibold">Dates</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Spots</th>
                  <th className="px-4 py-3 text-left font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {trips.map((t) => (
                  <tr key={t.trip_id}>
                    <td className="px-4 py-3 font-medium">{t.title}</td>
                    <td className="px-4 py-3 text-gray-500">{t.location}</td>
                    <td className="px-4 py-3 text-gray-500">{t.dates_start} → {t.dates_end}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        t.status === 'active' ? 'bg-green-100 text-green-700' :
                        t.status === 'sold_out' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3">{t.max_spots}</td>
                    <td className="px-4 py-3">${t.total_cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CUSTOMERS */}
        {activeTab === 'customers' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-bold mb-4">All Customers ({profiles.length})</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Admin</th>
                  <th className="px-4 py-3 text-left font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">{p.full_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.email}</td>
                    <td className="px-4 py-3">
                      {p.is_admin ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">Admin</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBSCRIBERS */}
        {activeTab === 'subscribers' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-bold mb-4">Subscribers ({subscribers.length})</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Subscribed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subscribers.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">{s.email}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CONTACTS */}
        {activeTab === 'contacts' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-bold mb-4">Contact Inquiries ({contacts.length})</h2>
            <div className="space-y-4">
              {contacts.map((c) => (
                <div key={c.id} className="border rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-gray-800">{c.full_name}</p>
                      <p className="text-sm text-gray-500">{c.email} {c.phone && `· ${c.phone}`}</p>
                    </div>
                    <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  {c.trip_interest && <p className="text-sm text-purple-600 mb-1">Interested in: {c.trip_interest}</p>}
                  {c.num_travelers && <p className="text-sm text-gray-500 mb-1">Travelers: {c.num_travelers}</p>}
                  <p className="text-sm text-gray-700">{c.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default withAuth(AdminDashboard);
