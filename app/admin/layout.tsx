import { Analytics } from '@vercel/analytics/next';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (

      {children}
      <Analytics />

  );
}
