// pages/how-it-works.tsx
'use client';
import { useEffect, useState } from 'react';
import { howItWorks } from '@/lib/queries-updated';

export default function HowItWorks() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    howItWorks.list().then(({ data, error }) => {
      if (!error) setFaqs(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">How It Works</h1>
      <div className="space-y-6">
        {faqs.map((faq) => (
          <div key={faq.faq_id} className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">{faq.question}</h3>
            <p className="text-gray-700">{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
