// pages/admin/login.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await auth.signIn(email, password);
    
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push('/admin/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-center">Admin Login</h2>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          {error && <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border rounded-lg p-3"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border rounded-lg p-3"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

// lib/withAuth.tsx - Protected route wrapper
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from './auth';

export function withAuth(Component: any) {
  return function ProtectedRoute(props: any) {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
      auth.getUser().then(({ data: { user } }) => {
        if (!user) {
          router.push('/admin/login');
        } else {
          setUser(user);
          setLoading(false);
        }
      });
    }, [router]);

    if (loading) return <div className="p-6">Loading...</div>;
    if (!user) return null;

    return <Component {...props} user={user} />;
  };
}
