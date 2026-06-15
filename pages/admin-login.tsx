'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/auth';

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

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await auth.signIn(email, password);
      
      if (signInError) {
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }

      // Check if user is admin
      const { data: profile } = await auth.getProfile();
      if (profile?.is_admin) {
        router.push('/admin');
      } else {
        setError('You do not have admin access.');
        setLoading(false);
      }
    } catch (err: any) {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', Arial, sans-serif", background: '#0f0620', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ background: '#1a0533', padding: '14px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(192,132,252,0.15)' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo.jpeg" alt="The Real Vacations" style={{ height: '52px' }} />
        </a>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <a href="/login" style={{ color: '#c084fc', fontSize: '14px', textDecoration: 'none' }}>← Back to Member Login</a>
        </div>
      </nav>

      {/* Main Page */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* Background gradients */}
        <div style={{ position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)', top: '-100px', left: '-100px', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(192,132,252,0.15) 0%, transparent 70%)', bottom: '-50px', right: '-50px', pointerEvents: 'none' }}></div>

        {/* Login Container */}
        <div style={{ background: '#1a0533', borderRadius: '28px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', border: '1px solid rgba(192,132,252,0.2)', position: 'relative', zIndex: 1, padding: '60px 50px', maxWidth: '500px', width: '100%' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: '#c084fc', fontWeight: '700', marginBottom: '16px' }}>🔐 Admin Access</div>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#fff', marginBottom: '12px' }}>Admin Portal</h2>
            <p style={{ fontSize: '14px', color: '#c4a8e6' }}>Manage bookings, customers, and service requests</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
                ❌ {error}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@therealvacations.com"
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  border: '2px solid rgba(192,132,252,0.3)',
                  borderRadius: '12px',
                  fontSize: '15px',
                  color: '#fff',
                  background: 'rgba(0,0,0,0.3)',
                  transition: 'all 0.2s',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  border: '2px solid rgba(192,132,252,0.3)',
                  borderRadius: '12px',
                  fontSize: '15px',
                  color: '#fff',
                  background: 'rgba(0,0,0,0.3)',
                  transition: 'all 0.2s',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff',
                padding: '14px',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '15px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '🔄 Authenticating...' : '🔓 Access Admin Dashboard'}
            </button>
          </form>

          <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(192,132,252,0.1)', borderRadius: '12px', borderLeft: '4px solid #7c3aed', fontSize: '12px', color: '#c4a8e6' }}>
            <strong style={{ color: '#fff' }}>🔒 Security Note:</strong> Only authorized administrators can access this portal. All login attempts are logged.
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#0f0620', color: '#555', textAlign: 'center', padding: '20px', fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        © 2026 The Real Vacations · <a href="mailto:contact@therealvacations.com" style={{ color: '#c084fc', textDecoration: 'none' }}>contact@therealvacations.com</a> · <a href="tel:4049230017" style={{ color: '#c084fc', textDecoration: 'none' }}>404-923-0017</a>
      </footer>
    </div>
  );
}
