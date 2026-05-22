import { useEffect, useState } from 'react';
import { trips } from '../lib/queries';

export default function Trips() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trips.list().then(({ data, error }: any) => {
      if (!error) setItems(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Trips</h1>
      <div className="grid gap-6">
        {items.map((item: any) => (
          <div key={item.id} className="border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-2">{item.title}</h2>
            <p className="text-gray-600">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
