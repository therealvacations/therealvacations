import { useEffect, useState } from 'react';
import { blog } from '../lib/queries';

export default function Blog() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    blog.list().then(({ data, error }: any) => {
      if (!error) setPosts(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Blog</h1>
      <div className="grid gap-6">
        {posts.map((post: any) => (
          <div key={post.id} className="border rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-2">{post.title}</h2>
            <p className="text-gray-600">{post.excerpt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
