import { useEffect, useState } from 'react';
import { resources } from '../lib/queries';

export default function Resources() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resources.list().then(({ data, error }: any) => {
      if (!error) setItems(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Resources</h1>
      <div className="grid gap-6">
        {items.map((item: any) => (
          <div key={item.resource_id} className="border rounded-lg p-6">
            <div className="flex items-start gap-4">
              {item.icon && <span className="text-3xl">{item.icon}</span>}
              <div className="flex-1">
                <span className="text-xs text-purple-600 font-semibold uppercase">{item.category}</span>
                <h2 className="text-xl font-bold mb-2">{item.title}</h2>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
