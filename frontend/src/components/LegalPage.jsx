import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function LegalPage({ title, content }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 text-slate-700">
      <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mt-6" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-4" {...props} />,
          p: ({ node, ...props }) => <p className="leading-relaxed" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto">
              <table className="table table-zebra text-sm" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-slate-100" {...props} />,
          th: ({ node, ...props }) => <th className="whitespace-nowrap" {...props} />,
          td: ({ node, ...props }) => <td className="align-top" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
