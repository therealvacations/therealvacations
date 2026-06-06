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
          <div key={item.trip_id} className="border rounded-lg p-6">
            {item.cover_image_url && (
              <img src={item.cover_image_url} alt={item.title} className="w-full h-48 object-cover rounded-lg mb-4" />
            )}
            <h2 className="text-xl font-bold mb-1">{item.title}</h2>
            <p className="text-gray-500 text-sm mb-2">{item.location}</p>
            <p className="text-sm text-gray-400 mb-3">
              {item.dates_start} → {item.dates_end}
            </p>
            <p className="text-gray-600 mb-4">{item.description_short}</p>
            <div className="flex justify-between items-center">
              <span className="text-purple-700 font-bold">${item.total_cost}</span>
              <span className="text-xs text-gray-400">{item.max_spots} spots available</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
