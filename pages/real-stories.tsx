import { useEffect, useState } from 'react';
import { realStories } from '../lib/queries';

export default function RealStories() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    realStories.list().then(({ data, error }: any) => {
      if (!error) setItems(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Real Stories</h1>
      <div className="grid gap-6">
        {items.map((item: any) => (
          <div key={item.id} className="border rounded-lg p-6">
            <p className="text-gray-600">{item.testimonial}</p>
            <p className="font-bold mt-2">{item.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
