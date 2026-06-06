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
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-700 text-white flex items-center justify-center font-bold text-sm">
                {item.author_initials}
              </div>
              <div>
                <p className="font-bold text-gray-800">{item.author_name}</p>
                <p className="text-sm text-gray-500">{item.trip_location} · {item.trip_date}</p>
              </div>
              <div className="ml-auto text-yellow-400 text-lg">
                {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
              </div>
            </div>
            <p className="text-gray-600">{item.review_text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
