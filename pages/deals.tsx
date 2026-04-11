// pages/deals.tsx
'use client';
import { useEffect, useState } from 'react';
import { deals } from '@/lib/queries-updated';

export default function Deals() {
  const [dealList, setDealList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deals.list().then(({ data, error }) => {
      if (!error) setDealList(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">Current Deals</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dealList.map((deal) => (
          <div key={deal.deal_id} className="border-2 border-blue-500 rounded-lg p-6 bg-blue-50">
            <div className="text-3xl mb-3">{deal.icon}</div>
            <h3 className="text-2xl font-bold mb-2">{deal.title}</h3>
            <p className="mb-4 text-gray-700">{deal.description}</p>
            {deal.link_url && (
              <a href={deal.link_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold">
                {deal.link_label}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
