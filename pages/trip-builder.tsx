'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withAuth } from '../lib/withAuth';
import { auth } from '../lib/auth';
import supabase from '../lib/supabase-integration';

function TripBuilder({ user }: { user: any }) {
  const router = useRouter();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTrip, setEditingTrip] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const emptyForm = {
    title: '',
    slug: '',
    location: '',
    dates_start: '',
    dates_end: '',
    description_short: '',
    description_full: '',
    cover_image_url: '',
    deposit_amount: '',
    total_cost: '',
    max_spots: '',
    status: 'active',
    stripe_product_id: '',
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    const { data } = await supabase.from('trips').select('*').order('dates_start', { ascending: true });
    setTrips(data || []);
    setLoading(false);
  };

  const handleEdit = (trip: any) => {
    setForm({
      title: trip.title || '',
      slug: trip.slug || '',
      location: trip.location || '',
      dates_start: trip.dates_start || '',
      dates_end: trip.dates_end || '',
      description_short: trip.description_short || '',
      description_full: trip.description_full || '',
      cover_image_url: trip.cover_image_url || '',
      deposit_amount: trip.deposit_amount || '',
      total_cost: trip.total_cost || '',
      max_spots: trip.max_spots || '',
      status: trip.status || 'active',
      stripe_product_id: trip.stripe_product_id || '',
    });
    setEditingTrip(trip);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNew = () => {
    setForm(emptyForm);
    setEditingTrip(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (trip_id: string) => {
    if (!confirm('Are you sure you want to delete this trip?')) return;
    await supabase.from('trips').delete().eq('trip_id', trip_id);
    fetchTrips();
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      deposit_amount: parseInt(form.deposit_amount as string) || 0,
      total_cost: parseInt(form.total_cost as string) || 0,
      max_spots: parseInt(form.max_spots as string) || 0,
    };

    if (editingTrip) {
      await supabase.from('trips').update(payload).eq('trip_id', editingTrip.trip_id);
      setSuccessMsg('Trip updated successfully!');
    } else {
      await supabase.from('trips').insert([payload]);
      setSuccessMsg('Trip created successfully!');
    }

    setSaving(false);
    setShowForm(false);
    setEditingTrip(null);
    setForm(emptyForm);
    fetchTrips();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-800">Trip Builder</h1>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</button>
            <button onClick={handleNew} className="bg-purple-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-800">+ New Trip</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {successMsg && (
          <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg font-medium">{successMsg}</div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-bold mb-6">{editingTrip ? 'Edit Trip' : 'Create New Trip'}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input className="w-full border rounded-lg p-3" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                <input className="w-full border rounded-lg p-3" placeholder="e.g. essence-festival-2026" value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input className="w-full border rounded-lg p-3" value={form.location} onChange={e => setForm({...form, location: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" className="w-full border rounded-lg p-3" value={form.dates_start} onChange={e => setForm({...form, dates_start: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" className="w-full border rounded-lg p-3" value={form.dates_end} onChange={e => setForm({...form, dates_end: e.target.value})} required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                <input className="w-full border rounded-lg p-3" value={form.description_short} onChange={e => setForm({...form, description_short: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
                <textarea className="w-full border rounded-lg p-3" rows={4} value={form.description_full} onChange={e => setForm({...form, description_full: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
                <input className="w-full border rounded-lg p-3" placeholder="https://..." value={form.cover_image_url} onChange={e => setForm({...form, cover_image_url: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount ($)</label>
                <input type="number" className="w-full border rounded-lg p-3" value={form.deposit_amount} onChange={e => setForm({...form, deposit_amount: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Cost ($)</label>
                <input type="number" className="w-full border rounded-lg p-3" value={form.total_cost} onChange={e => setForm({...form, total_cost: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Spots</label>
                <input type="number" className="w-full border rounded-lg p-3" value={form.max_spots} onChange={e => setForm({...form, max_spots: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="w-full border rounded-lg p-3" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="sold_out">Sold Out</option>
                  <option value="draft">Draft</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Product ID</label>
                <input className="w-full border rounded-lg p-3" placeholder="prod_..." value={form.stripe_product_id} onChange={e => setForm({...form, stripe_product_id: e.target.value})} />
              </div>
              <div className="md:col-span-2 flex gap-3 mt-2">
                <button type="submit" disabled={saving} className="bg-purple-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-800 disabled:opacity-50">
                  {saving ? 'Saving...' : editingTrip ? 'Update Trip' : 'Create Trip'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingTrip(null); setForm(emptyForm); }} className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Trip List */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold mb-4">All Trips ({trips.length})</h2>
          {loading ? <p>Loading...</p> : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <div key={trip.trip_id} className="border rounded-xl p-4 flex justify-between items-center">
                  <div className="flex gap-4 items-center">
                    {trip.cover_image_url && (
                      <img src={trip.cover_image_url} alt={trip.title} className="w-16 h-16 object-cover rounded-lg" />
                    )}
                    <div>
                      <p className="font-bold text-gray-800">{trip.title}</p>
                      <p className="text-sm text-gray-500">{trip.location} · {trip.dates_start} → {trip.dates_end}</p>
                      <p className="text-sm text-gray-500">${trip.total_cost} · {trip.max_spots} spots</p>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        trip.status === 'active' ? 'bg-green-100 text-green-700' :
                        trip.status === 'sold_out' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{trip.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(trip)} className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-200">Edit</button>
                    <button onClick={() => handleDelete(trip.trip_id)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default withAuth(TripBuilder);
