import React from 'react';

export type FAQItem = {
  question: string;
  answer: string;
};

// Builds the FAQPage JSON-LD from the same items rendered by ArticleFAQ so the
// structured data always matches the visible page content.
export const faqPageSchema = (faqs: FAQItem[]) => ({
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: { '@type': 'Answer', text: faq.answer },
  })),
});

export const ArticleFAQ: React.FC<{ faqs: FAQItem[] }> = ({ faqs }) => (
  <>
    <h2 className="text-2xl font-semibold text-white mt-12 mb-6">Frequently asked questions</h2>
    <div className="space-y-4">
      {faqs.map((faq) => (
        <div key={faq.question} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <h3 className="text-lg font-semibold text-white mb-3">{faq.question}</h3>
          <p className="text-white/80 leading-relaxed">{faq.answer}</p>
        </div>
      ))}
    </div>
  </>
);
