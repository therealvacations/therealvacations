'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/auth';
import supabase from '../lib/supabase-integration';

export default function Register() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    agreed_to_terms: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: any) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!form.agreed_to_terms) {
      setError('You must agree to the terms to create an account.');
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').insert([{
        id: data.user.id,
        email: form.email,
        full_name: form.full_name,
        is_admin: false,
      }]);
    }

    // Redirect to CC auth form before portal
    router.push('/cc-auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4" style={{ background: 'linear-gradient(135deg, #1a0533 0%, #3b0764 100%)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1a0533, #3b0764)' }} className="p-6 text-center">
          <img src="https://therealvacations.com/logo.jpeg" alt="The Real Vacations" className="h-14 w-auto rounded-lg mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Create Your Account</h1>
          <p className="text-purple-300 text-sm mt-1">Join The Real Vacations Member Portal</p>
        </div>

        <div className="p-6">

          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-purple-700 text-white text-xs flex items-center justify-center font-bold">1</div>
              <span className="text-xs font-medium text-purple-700">Create Account</span>
            </div>
            <div className="w-8 h-px bg-gray-300"></div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center font-bold">2</div>
              <span className="text-xs text-gray-400">CC Authorization</span>
            </div>
            <div className="w-8 h-px bg-gray-300"></div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center font-bold">3</div>
              <span className="text-xs text-gray-400">My Portal</span>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                placeholder="Your full legal name"
                value={form.full_name}
                onChange={e => setForm({...form, full_name: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                placeholder="you@email.com"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                placeholder="Repeat your password"
                value={form.confirm_password}
                onChange={e => setForm({...form, confirm_password: e.target.value})}
                required
              />
            </div>

            {/* Terms agreement */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-5 h-5 accent-purple-700 shrink-0"
                  checked={form.agreed_to_terms}
                  onChange={e => setForm({...form, agreed_to_terms: e.target.checked})}
                />
                <span className="text-sm text-gray-600 leading-relaxed">
                  I agree to The Real Vacations{' '}
                  <a href="/cc-auth" target="_blank" className="text-purple-700 font-medium underline hover:text-purple-900">
                    Credit Card Authorization Agreement
                  </a>
                  {' '}and authorize charges to my card on file per my booking payment schedule. I understand I will complete the full CC authorization form on the next step.
                </span>
              </label>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ background: 'linear-gradient(135deg, #1a0533, #6b21a8)' }}
              className="w-full text-white py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 shadow-lg"
            >
              {loading ? 'Creating Account...' : 'Create Account & Continue →'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <a href="/login" className="text-purple-700 font-medium hover:underline">Login</a>
          </p>
        </div>
      </div>
    </div>
  );
}
