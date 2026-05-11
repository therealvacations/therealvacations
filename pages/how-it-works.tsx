import { useEffect, useState } from 'react';
import { howItWorks } from '@/lib/queries';

export default function HowItWorks() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    howItWorks.list().then(({ data, error }: any) => {
      if (!error) setItems(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">How It Works</h1>
      <div className="grid gap-6">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-2">{item.question}</h2>
            <p className="text-gray-700">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
