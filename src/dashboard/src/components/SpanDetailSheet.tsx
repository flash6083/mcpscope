import type { SpanRow } from "./TimelineTable.js";

export function SpanDetailSheet({ span, onClose }: { span: SpanRow | null; onClose: () => void }) {
  if (!span) return null;
  const attrs = span.attributes ? JSON.parse(span.attributes) : {};

  return (
    <div className="fixed right-0 top-0 h-full w-[500px] bg-white border-l shadow-lg p-4 overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">{span.name}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Close
        </button>
      </div>
      <div className="space-y-4 text-sm">
        <div>
          <span className="font-medium text-gray-500">Span ID:</span>
          <code className="ml-2 text-xs">{span.span_id}</code>
        </div>
        <div>
          <span className="font-medium text-gray-500">Duration:</span>
          <span className="ml-2">{span.end_time - span.start_time}ms</span>
        </div>
        <div>
          <span className="font-medium text-gray-500">Status:</span>
          <span className="ml-2">{span.status}</span>
        </div>
        <div>
          <span className="font-medium text-gray-500">Attributes:</span>
          <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto">
            {JSON.stringify(attrs, null, 2)}
          </pre>
        </div>
        {span.request_body && (
          <div>
            <span className="font-medium text-gray-500">Request:</span>
            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto">
              {span.request_body}
            </pre>
          </div>
        )}
        {span.response_body && (
          <div>
            <span className="font-medium text-gray-500">Response:</span>
            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto">
              {span.response_body}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
