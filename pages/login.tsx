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
      const { error: signInError } = await auth.signIn(email, password);
      if (signInError) {
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }
      router.push('/my-trips');
    } catch (err: any) {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', Arial, sans-serif", background: '#0f0620', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ background: '#1a0533', padding: '14px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(192,132,252,0.15)' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo.jpeg" alt="The Real Vacations" style={{ height: '52px' }} />
        </a>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <a href="/" style={{ color: '#fff', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>Home</a>
          <a href="/trips" style={{ color: '#fff', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>Trips</a>
          <a href="/deals" style={{ color: '#fff', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>Deals</a>
          <a href="/contact" style={{ color: '#fff', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>Contact</a>
          <a href="/signup" style={{ background: '#c084fc', color: '#1a0533', padding: '8px 20px', borderRadius: '50px', fontWeight: '700', textDecoration: 'none', fontSize: '14px' }}>Sign Up Free</a>
        </div>
      </nav>

      {/* Main Page */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* Background gradients */}
        <div style={{ position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)', top: '-100px', left: '-100px', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(192,132,252,0.15) 0%, transparent 70%)', bottom: '-50px', right: '-50px', pointerEvents: 'none' }}></div>

        {/* Login Container */}
        <div style={{ display: 'flex', gap: 0, maxWidth: '960px', width: '100%', background: '#1a0533', borderRadius: '28px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', border: '1px solid rgba(192,132,252,0.2)', position: 'relative', zIndex: 1 }}>
          {/* Left Side */}
          <div style={{ flex: 1, background: 'linear-gradient(160deg, #3b0764, #1a0533 60%, #0f0620)', padding: '56px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: '#c084fc', fontWeight: '700', marginBottom: '20px' }}>Member Portal</div>
            
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: '800', color: '#fff', lineHeight: '1.2', marginBottom: '20px' }}>
              Your next adventure<br />starts <span style={{ color: '#c084fc' }}>right here.</span>
            </h2>

            <p style={{ fontSize: '15px', color: '#c4a8e6', lineHeight: '1.7', marginBottom: '36px' }}>
              Log in to track your trips, manage payments, access exclusive deals, and connect with your travel group — all in one place.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '36px' }}>
              {[
                { icon: '📅', title: 'Trip Dashboard', desc: 'Track countdown, payments & itinerary' },
                { icon: '💳', title: 'Payment Tracker', desc: 'Stay on top of your payment schedule' },
                { icon: '✈️', title: 'Exclusive Travel Deals', desc: 'Flights, hotels & experiences curated for you' },
                { icon: '👥', title: 'Group Chat Access', desc: 'Meet your fellow travelers before departure' },
              ].map((perk, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', background: 'rgba(192,132,252,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                    {perk.icon}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px', color: '#fff', fontWeight: '600' }}>{perk.title}</strong>
                    <span style={{ fontSize: '12px', color: '#9d77c8' }}>{perk.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['🎵 Essence Fest', '🎤 Mary J Vegas', '🎷 Keith Sweat ATL'].map((trip, i) => (
                <span key={i} style={{ background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.25)', borderRadius: '50px', padding: '6px 14px', fontSize: '12px', color: '#c084fc', fontWeight: '600' }}>
                  {trip}
                </span>
              ))}
            </div>
          </div>

          {/* Right Side */}
          <div style={{ width: '420px', background: '#fff', padding: '52px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: '26px', fontWeight: '800', color: '#1a0533', marginBottom: '6px' }}>Welcome back!</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '32px' }}>
              Don't have an account? <a href="/signup" style={{ color: '#7c3aed', fontWeight: '600', textDecoration: 'none' }}>Sign up free →</a>
            </p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
              {error && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                  ❌ {error}
                </div>
              )}

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1a0533', marginBottom: '7px' }}>Email Address</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: '#1a0533',
                    background: '#fafafa',
                    transition: 'all 0.2s',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1a0533', marginBottom: '7px' }}>Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '15px',
                    color: '#1a0533',
                    background: '#fafafa',
                    transition: 'all 0.2s',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#555', cursor: 'pointer' }}>
                  <input type="checkbox" style={{ accentColor: '#7c3aed', width: '16px', height: '16px' }} />
                  Remember me
                </label>
                <a href="/forgot-password" style={{ fontSize: '13px', color: '#7c3aed', fontWeight: '600', textDecoration: 'none' }}>Forgot password?</a>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  color: '#fff',
                  padding: '15px',
                  borderRadius: '12px',
                  fontWeight: '700',
                  fontSize: '16px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  letterSpacing: '0.3px',
                  opacity: loading ? 0.7 : 1,
                  transform: loading ? 'none' : undefined,
                }}
              >
                {loading ? 'Signing in...' : 'Sign In to My Dashboard →'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '14px', color: '#666' }}>
              New here? <a href="/signup" style={{ color: '#7c3aed', fontWeight: '700', textDecoration: 'none' }}>Create your free account</a>
            </div>

            <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '16px', lineHeight: '1.6' }}>
              🔒 Your information is secure and never shared or sold. Ever.
            </p>
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
