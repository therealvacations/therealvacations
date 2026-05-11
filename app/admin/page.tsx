'use client';
import { withAuth } from '@/lib/withAuth';

function AdminPage({ user }: { user: any }) {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome, {user.email}</p>
    </div>
  );
}

export default withAuth(AdminPage);
