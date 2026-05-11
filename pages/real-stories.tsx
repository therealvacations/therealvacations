import { useEffect, useState } from 'react';
import { realStories } from '@/lib/queries';

export default function RealStories() {
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    realStories.list().then(({ data, error }: any) => {
      if (!error) setStories(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Real Stories</h1>
      <div className="grid gap-6">
        {stories.map((story) => (
          <div key={story.id} className="border rounded-lg p-6">
            <p className="text-gray-700 mb-4">"{story.testimonial_text}"</p>
            <p className="font-semibold">{story.traveler_name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
