'use client';
import { withAuth } from '@/lib/withAuth';
import supabase from '@/lib/supabase-integration';
import { useState } from 'react';

function ContentManager({ user }: { user: any }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePublish = async (table: string) => {
    setLoading(true);
    await supabase.from(table).insert([{ title, content }]);
    setTitle(''); setContent(''); setLoading(false);
    alert('Published!');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Manage Content</h1>
        <div className="space-y-4">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full border rounded-lg p-3" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full border rounded-lg p-3" rows={8} />
          <button onClick={() => handlePublish('blog_posts')} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded">Publish to Blog</button>
        </div>
      </div>
    </div>
  );
}

export default withAuth(ContentManager);
