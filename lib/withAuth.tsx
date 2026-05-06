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
      const checkAuth = async () => {
        try {
          const { data } = await auth.getUser();
          if (!data?.user) {
            router.push('/admin-login');
          } else {
            setUser(data.user);
          }
        } catch (error) {
          router.push('/admin-login');
        } finally {
          setLoading(false);
        }
      };

      checkAuth();
    }, [router]);

    if (loading) return <div className="p-6 text-center">Loading...</div>;
    if (!user) return null;
    return <Component {...props} user={user} />;
  };
}
