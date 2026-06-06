import { useEffect, useState } from 'react';
import { deals } from '../lib/queries';

export default function Deals() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deals.list().then(({ data, error }: any) => {
      if (!error) setItems(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Deals</h1>
      <div className="grid gap-6">
        {items.map((item: any) => (
          <div key={item.deal_id} className="border rounded-lg p-6">
            {item.icon && <span className="text-3xl mb-2 block">{item.icon}</span>}
            <h2 className="text-2xl font-bold mb-2">{item.title}</h2>
            <p className="text-gray-600 mb-4">{item.description}</p>
            {item.link_url && (
              <a
                href={item.link_url}
                className="inline-block bg-purple-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-800"
              >
                {item.link_label || 'Learn More'}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
