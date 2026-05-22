import { useState } from 'react';
import { contact } from '../lib/queries';

export default function Contact() {
  const [form, setForm] = useState({ full_name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await contact.submit(form);
    setSubmitted(true);
  };

  if (submitted) return <div className="p-6 text-center"><h2 className="text-2xl font-bold">Message sent! We'll be in touch soon.</h2></div>;
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Contact Us</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input className="border rounded p-3" placeholder="Full Name" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required/>
        <input className="border rounded p-3" type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required/>
        <textarea className="border rounded p-3" placeholder="Message" rows={5} value={form.message} onChange={e => setForm({...form, message: e.target.value})} required/>
        <button type="submit" className="bg-purple-700 text-white py-3 rounded-full font-bold">Send Message →</button>
      </form>
    </div>
  );
}
