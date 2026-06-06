'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/auth';
import supabase from '../lib/supabase-integration';

export default function MyTrips() {
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data } = await auth.getUser();
      if (!data?.user) {
        router.push('/login');
        return;
      }
      setUser(data.user);

      // Get user's bookings with trip details
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('*, trips(title, dates_start, dates_end, location, cover_image_url)')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false });

      setBookings(bookingData || []);

      // Get payment schedule
      const { data: paymentData } = await supabase
        .from('payment_schedule')
        .select('*')
        .in('booking_id', (bookingData || []).map((b: any) => b.booking_id))
        .order('due_date', { ascending: true });

      setPayments(paymentData || []);
      setLoading(false);
    };
    init();
  }, [router]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500 text-lg">Loading your trips...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-800">My Trips</h1>
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600">{user?.email}</p>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Bookings */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            My Bookings ({bookings.length})
          </h2>
          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No bookings yet.</p>
              <button
                onClick={() => router.push('/trips')}
                className="bg-purple-700 text-white px-6 py-2 rounded-lg hover:bg-purple-800"
              >
                Browse Trips
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div key={b.booking_id} className="border rounded-xl p-4">
                  {b.trips?.cover_image_url && (
                    <img src={b.trips.cover_image_url} alt={b.trips.title} className="w-full h-40 object-cover rounded-lg mb-3" />
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800">{b.trips?.title || 'Trip'}</p>
                      <p className="text-sm text-gray-500">{b.trips?.location}</p>
                      <p className="text-sm text-gray-500">
                        {b.trips?.dates_start} → {b.trips?.dates_end}
                      </p>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full mt-1 inline-block ${
                        b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        b.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-700">${b.total_amount}</p>
                      <p className="text-xs text-gray-400">Total</p>
                      <p className="font-semibold text-gray-700 mt-1">${b.amount_paid}</p>
                      <p className="text-xs text-gray-400">Paid</p>
                      <p className="font-semibold text-red-500 mt-1">${b.balance_due}</p>
                      <p className="text-xs text-gray-400">Balance Due</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Schedule */}
        {payments.length > 0 && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Payment Schedule</h2>
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.schedule_id} className="flex justify-between items-center border-b pb-3">
                  <div>
                    <p className="font-medium text-gray-700">Payment {p.payment_number}</p>
                    <p className="text-sm text-gray-400">Due: {new Date(p.due_date).toLocaleDateString()}</p>
                    {p.auto_charge_date && (
                      <p className="text-sm text-gray-400">Auto-charge: {new Date(p.auto_charge_date).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${p.amount_due}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      p.status === 'paid' ? 'bg-green-100 text-green-700' :
                      p.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
