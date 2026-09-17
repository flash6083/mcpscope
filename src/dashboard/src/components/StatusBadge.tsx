export function StatusBadge({ status }: { status: string }) {
  const color = status === "OK" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {status}
    </span>
  );
}
