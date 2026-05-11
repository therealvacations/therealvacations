import { useState } from 'react';
import { contact } from '@/lib/queries';

export default function Contact() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error: err } = await contact.submit(form) as any;
    if (err) {
      setError('Something went wrong. Please try again.');
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) return <div className="p-6 text-center text-green-600 text-xl">Message sent! We'll be in touch soon.</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Contact Us</h1>
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full border rounded-lg p-3" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded-lg p-3" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border rounded-lg p-3" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full border rounded-lg p-3" rows={5} required />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
}
