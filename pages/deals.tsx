import { useEffect, useState } from 'react';
import { deals } from '@/lib/queries';

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
        {items.map((deal) => (
          <div key={deal.id} className="border rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-2">{deal.title}</h2>
            <p className="text-gray-700">{deal.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
