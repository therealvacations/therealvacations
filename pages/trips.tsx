// pages/trips.tsx
'use client';
import { useEffect, useState } from 'react';
import { trips } from '@/lib/queries-updated';

export default function Trips() {
  const [tripList, setTripList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trips.list().then(({ data, error }) => {
      if (!error) setTripList(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">Featured Trips</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tripList.map((trip) => (
          <div key={trip.trip_id} className="border rounded-lg overflow-hidden hover:shadow-lg">
            {trip.cover_image_url && <img src={trip.cover_image_url} alt={trip.title} className="w-full h-48 object-cover" />}
            <div className="p-4">
              <h3 className="text-xl font-semibold">{trip.title}</h3>
              <p className="text-gray-600 text-sm">{trip.location}</p>
              <p className="text-gray-700 mt-2 text-sm">{trip.description_short}</p>
              <div className="mt-4 flex justify-between items-center">
                <span className="font-bold">${trip.total_cost / 100}</span>
                <a href={`/trips/${trip.slug}`} className="text-blue-600">Details →</a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
