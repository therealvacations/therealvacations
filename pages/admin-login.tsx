'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/auth';
import supabase from '../lib/supabase-integration';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await auth.signIn(email, password);

    if (signInError) {
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }

    // Check if user is an admin
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', data.user?.id)
      .single();

    if (!adminData) {
      await auth.signOut();
      setError('You do not have admin access.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-800">Admin Login</h1>
          <p className="text-gray-500 mt-2">The Real Vacations</p>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="admin@therealvacations.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
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
            {loading ? 'Logging in...' : 'Login to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
