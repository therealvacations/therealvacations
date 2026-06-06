import { useState } from 'react';
import { contact } from '../lib/queries';

export default function Contact() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    trip_interest: '',
    num_travelers: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    await contact.submit({
      ...form,
      num_travelers: form.num_travelers ? parseInt(form.num_travelers) : undefined,
    });
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) return (
    <div className="p-6 text-center">
      <h2 className="text-2xl font-bold text-purple-700">Message sent!</h2>
      <p className="text-gray-600 mt-2">We'll be in touch soon.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Contact Us</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          className="border rounded p-3"
          placeholder="Full Name"
          value={form.full_name}
          onChange={e => setForm({...form, full_name: e.target.value})}
          required
        />
        <input
          className="border rounded p-3"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={e => setForm({...form, email: e.target.value})}
          required
        />
        <input
          className="border rounded p-3"
          type="tel"
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={e => setForm({...form, phone: e.target.value})}
        />
        <input
          className="border rounded p-3"
          placeholder="Which trip are you interested in? (optional)"
          value={form.trip_interest}
          onChange={e => setForm({...form, trip_interest: e.target.value})}
        />
        <input
          className="border rounded p-3"
          type="number"
          placeholder="Number of travelers (optional)"
          value={form.num_travelers}
          onChange={e => setForm({...form, num_travelers: e.target.value})}
          min="1"
        />
        <textarea
          className="border rounded p-3"
          placeholder="Message"
          rows={5}
          value={form.message}
          onChange={e => setForm({...form, message: e.target.value})}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-purple-700 text-white py-3 rounded-full font-bold hover:bg-purple-800 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Message →'}
        </button>
      </form>
    </div>
  );
}
