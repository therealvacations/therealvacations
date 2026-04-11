// pages/resources.tsx
'use client';
import { useEffect, useState } from 'react';
import { resources } from '@/lib/queries-updated';

export default function Resources() {
  const [resourceList, setResourceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resources.list().then(({ data, error }) => {
      if (!error) setResourceList(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">Resources</h1>
      <div className="space-y-6">
        {resourceList.map((resource) => (
          <div key={resource.resource_id} className="border rounded-lg p-6 hover:shadow-lg">
            <div className="text-3xl mb-2">{resource.icon}</div>
            <h3 className="text-xl font-semibold">{resource.title}</h3>
            {resource.category && <p className="text-sm text-gray-600 mt-1">{resource.category}</p>}
            <p className="mt-3 text-gray-700">{resource.description}</p>
            {resource.link_url && (
              <a href={resource.link_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 mt-4 inline-block">
                {resource.link_label}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
