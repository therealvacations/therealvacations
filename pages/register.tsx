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

    setLoading(true);

    // Create auth user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Create profile record
    if (data.user) {
      await supabase.from('profiles').insert([{
        id: data.user.id,
        email: form.email,
        full_name: form.full_name,
        is_admin: false,
      }]);
    }

    router.push('/my-trips');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-800">Create Account</h1>
          <p className="text-gray-500 mt-2">Join The Real Vacations</p>
        </div>
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Your full name"
              value={form.full_name}
              onChange={e => setForm({...form, full_name: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Repeat your password"
              value={form.confirm_password}
              onChange={e => setForm({...form, confirm_password: e.target.value})}
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-purple-700 text-white py-3 rounded-lg font-bold hover:bg-purple-800 disabled:opacity-50 mt-2"
          >
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>
          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a href="/login" className="text-purple-700 font-medium hover:underline">Login</a>
          </p>
        </form>
      </div>
    </div>
  );
}
