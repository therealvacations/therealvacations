// pages/about.tsx
'use client';
import { useEffect, useState } from 'react';
import { about } from '@/lib/queries';

export default function About() {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    about.get().then(({ data, error }) => {
      if (!error) setContent(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">About Us</h1>
      <p className="text-lg text-gray-700 mb-8">{content?.story_text}</p>
      
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="text-center">
          <p className="text-3xl font-bold">{content?.years_experience}+</p>
          <p className="text-gray-600">Years Experience</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold">{content?.happy_travelers}+</p>
          <p className="text-gray-600">Happy Travelers</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold">{content?.trips_organized}+</p>
          <p className="text-gray-600">Trips Organized</p>
        </div>
      </div>

      {content?.values_json && (
        <div className="grid grid-cols-2 gap-6">
          {content.values_json.map((value: any, i: number) => (
            <div key={i} className="border rounded-lg p-4">
              <p className="text-3xl mb-2">{value.icon}</p>
              <h3 className="font-semibold">{value.title}</h3>
              <p className="text-sm text-gray-600">{value.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
