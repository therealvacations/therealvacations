'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await auth.signIn(email, password);

    if (signInError) {
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }

    router.push('/my-trips');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-800">Member Login</h1>
          <p className="text-gray-500 mt-2">Access your trips and payments</p>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="you@email.com"
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
            {loading ? 'Logging in...' : 'Login →'}
          </button>
          <p className="text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <a href="/register" className="text-purple-700 font-medium hover:underline">Sign up</a>
          </p>
        </form>
      </div>
    </div>
  );
}
