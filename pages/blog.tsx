// pages/blog.tsx
'use client';
import { useEffect, useState } from 'react';
import { blog } from '@/lib/queries-updated';

export default function Blog() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    blog.list().then(({ data, error }) => {
      if (!error) setPosts(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>
      <div className="space-y-6">
        {posts.map((post) => (
          <article key={post.id} className="border rounded-lg p-4 hover:shadow-lg">
            <h2 className="text-2xl font-semibold">{post.title}</h2>
            {post.category && <p className="text-sm text-gray-500">{post.category}</p>}
            <p className="text-gray-600 mt-2">{post.excerpt}</p>
            <a href={`/blog/${post.slug}`} className="text-blue-600 mt-4 inline-block">Read More →</a>
          </article>
        ))}
      </div>
    </div>
  );
}
