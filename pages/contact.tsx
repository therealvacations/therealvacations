// pages/contact.tsx
'use client';
import { useState } from 'react';
import { contact } from '@/lib/queries-updated';

export default function Contact() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    trip_interest: '',
    num_travelers: 1,
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await contact.submit(form);
    setSuccess(true);
    setForm({ full_name: '', email: '', phone: '', trip_interest: '', num_travelers: 1, message: '' });
    setLoading(false);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">Contact Us</h1>
      {success && <div className="bg-green-100 border border-green-400 text-green-700 p-4 rounded mb-6">Message sent!</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-2">Name</label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="w-full border rounded-lg p-3"
            required
          />
        </div>
        <div>
          <label className="block font-semibold mb-2">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border rounded-lg p-3"
            required
          />
        </div>
        <div>
          <label className="block font-semibold mb-2">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border rounded-lg p-3"
          />
        </div>
        <div>
          <label className="block font-semibold mb-2">Interested In</label>
          <input
            type="text"
            value={form.trip_interest}
            onChange={(e) => setForm({ ...form, trip_interest: e.target.value })}
            placeholder="e.g., Essence Festival, Music Tours"
            className="w-full border rounded-lg p-3"
          />
        </div>
        <div>
          <label className="block font-semibold mb-2">Number of Travelers</label>
          <input
            type="number"
            value={form.num_travelers}
            onChange={(e) => setForm({ ...form, num_travelers: parseInt(e.target.value) })}
            className="w-full border rounded-lg p-3"
            min="1"
          />
        </div>
        <div>
          <label className="block font-semibold mb-2">Message</label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full border rounded-lg p-3"
            rows={6}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
}
