// pages/real-stories.tsx
'use client';
import { useEffect, useState } from 'react';
import { realStories } from '@/lib/queries-updated';

export default function RealStories() {
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    realStories.list().then(({ data, error }) => {
      if (!error) setStories(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">Real Stories</h1>
      <div className="space-y-6">
        {stories.map((story) => (
          <div key={story.id} className="border-l-4 border-blue-600 pl-6 py-4 bg-gray-50 p-6 rounded">
            <p className="text-lg italic mb-4">"{story.review_text}"</p>
            <div>
              <p className="font-semibold">{story.author_name}</p>
              {story.trip_location && <p className="text-sm text-gray-600">{story.trip_location}</p>}
              {story.rating && <p className="text-yellow-500">{'⭐'.repeat(story.rating)}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
