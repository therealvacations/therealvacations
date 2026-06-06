'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '../lib/supabase-integration';
import { auth } from '../lib/auth';

export default function CCAuth() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    billing_address: '',
    city: '',
    state: '',
    zip: '',
    card_type: '',
    card_last4: '',
    card_expiry: '',
    cardholder_name: '',
    agreed: false,
  });
  const [signature, setSignature] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!signature.trim()) { setError('Please type your full name as your electronic signature.'); return; }
    if (!form.agreed) { setError('You must agree to the terms to proceed.'); return; }
    setLoading(true);
    setError('');

    const { data: userData } = await auth.getUser();

    await supabase.from('contact_submissions').insert([{
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      message: `CC AUTH FORM SUBMITTED — Cardholder: ${form.cardholder_name}, Card Type: ${form.card_type}, Last 4: ${form.card_last4}, Expiry: ${form.card_expiry}, Billing: ${form.billing_address}, ${form.city}, ${form.state} ${form.zip}, Signed: ${signature}, Date: ${today}`,
      trip_interest: 'Credit Card Authorization',
    }]);

    if (userData?.user) {
      await supabase.from('user_payment_methods').insert([{
        user_id: userData.user.id,
        cardholder_name: form.cardholder_name,
        last4: form.card_last4,
        is_default: true,
      }]);
    }

    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a0533, #3b0764)' }}>
      <div className="bg-white rounded-2xl p-10 max-w-md text-center shadow-2xl">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Authorization Received</h2>
        <p className="text-gray-500 mb-6">Your credit card authorization has been submitted and is on file with The Real Vacations.</p>
        <a href="/my-trips" style={{ background: 'linear-gradient(135deg, #3b0764, #6b21a8)' }} className="inline-block text-white px-8 py-3 rounded-full font-bold hover:opacity-90">
          Go to My Portal →
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div style={{ background: 'linear-gradient(135deg, #1a0533, #3b0764)' }} className="p-6 flex justify-between items-center">
            <div>
              <h1 className="text-white text-2xl font-bold">Credit Card Authorization</h1>
              <p className="text-purple-300 text-sm mt-1">The Real Vacations — Member Agreement</p>
            </div>
            <img src="https://therealvacations.com/logo.jpeg" alt="The Real Vacations" className="h-14 w-auto rounded-lg" />
          </div>

          <div className="p-6 border-b border-gray-100 bg-purple-50">
            <p className="text-sm text-gray-700 leading-relaxed">
              This Credit Card Authorization Agreement is entered into between <strong>The Real Vacations</strong> ("Company") and the undersigned member ("Cardholder"). By signing this form, you authorize The Real Vacations to charge the credit card provided on file for all trip deposits, installment payments, and balances due in accordance with your booking agreement and payment schedule.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Personal Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-4">👤 Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Legal Name *</label>
                <input className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input type="email" className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input type="tel" className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address *</label>
                <input className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" value={form.billing_address} onChange={e => setForm({...form, billing_address: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" value={form.city} onChange={e => setForm({...form, city: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" maxLength={2} placeholder="GA" value={form.state} onChange={e => setForm({...form, state: e.target.value.toUpperCase()})} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
                  <input className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" value={form.zip} onChange={e => setForm({...form, zip: e.target.value})} required />
                </div>
              </div>
            </div>
          </div>

          {/* Card Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-4">💳 Card Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name on Card *</label>
                <input className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" value={form.cardholder_name} onChange={e => setForm({...form, cardholder_name: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Type *</label>
                <select className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" value={form.card_type} onChange={e => setForm({...form, card_type: e.target.value})} required>
                  <option value="">Select card type</option>
                  <option>Visa</option>
                  <option>Mastercard</option>
                  <option>American Express</option>
                  <option>Discover</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last 4 Digits *</label>
                <input className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" maxLength={4} placeholder="XXXX" value={form.card_last4} onChange={e => setForm({...form, card_last4: e.target.value.replace(/\D/g, '')})} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date *</label>
                <input className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="MM/YY" maxLength={5} value={form.card_expiry} onChange={e => setForm({...form, card_expiry: e.target.value})} required />
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-4">📋 Authorization Terms</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-3 mb-4 max-h-48 overflow-y-auto leading-relaxed">
              <p><strong>1. Authorization.</strong> I authorize The Real Vacations to charge the credit card provided for all deposits, installment payments, and balances related to my booking(s).</p>
              <p><strong>2. Payment Schedule.</strong> I understand and agree to the payment schedule outlined at the time of booking. Payments will be charged on or before the dates specified.</p>
              <p><strong>3. Auto-Pay.</strong> Where auto-pay is enabled, I authorize automatic charges on scheduled dates without additional notice.</p>
              <p><strong>4. Cancellation & Refunds.</strong> I understand that cancellation policies apply and refunds, if applicable, will be returned to this card.</p>
              <p><strong>5. Chargebacks.</strong> I agree not to initiate chargebacks for valid charges made pursuant to this authorization. I will contact The Real Vacations directly to resolve any billing disputes.</p>
              <p><strong>6. Card Updates.</strong> I agree to notify The Real Vacations promptly of any changes to my card information, including expiration date or card replacement.</p>
              <p><strong>7. Security.</strong> The Real Vacations does not store full card numbers. Card information is processed securely through Stripe, a PCI-compliant payment processor.</p>
              <p><strong>8. Governing Law.</strong> This agreement is governed by the laws of the State of Georgia.</p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-1 w-5 h-5 accent-purple-700" checked={form.agreed} onChange={e => setForm({...form, agreed: e.target.checked})} required />
              <span className="text-sm text-gray-700">I have read and agree to the Credit Card Authorization Terms above. I authorize The Real Vacations to charge my card on file per the terms stated.</span>
            </label>
          </div>

          {/* Signature */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-1">✍️ Electronic Signature</h2>
            <p className="text-sm text-gray-500 mb-4">Type your full legal name below as your electronic signature. By signing, you confirm that all information provided is accurate.</p>
            <input
              className="w-full border-b-2 border-gray-300 focus:border-purple-600 outline-none p-3 text-xl italic text-gray-800 bg-transparent"
              style={{ fontFamily: 'Georgia, serif' }}
              placeholder="Type your full name here..."
              value={signature}
              onChange={e => setSignature(e.target.value)}
            />
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>Electronic Signature</span>
              <span>Date: {today}</span>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-200">{error}</div>}

          <button type="submit" disabled={loading}
            style={{ background: 'linear-gradient(135deg, #1a0533, #6b21a8)' }}
            className="w-full text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 disabled:opacity-50 shadow-lg">
            {loading ? 'Submitting...' : '✅ Submit Authorization'}
          </button>

          <p className="text-center text-xs text-gray-400 pb-6">
            🔒 Secured by Stripe · PCI Compliant · The Real Vacations LLC
          </p>
        </form>
      </div>
    </div>
  );
}
