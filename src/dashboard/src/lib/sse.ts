import { useEffect, useState } from "react";

export function useEventSource(url: string) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const es = new EventSource(url);
    es.onmessage = (e) => setData(JSON.parse(e.data));
    es.onerror = () => es.close();
    return () => es.close();
  }, [url]);

  return data;
}
