import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; className: string }> = {
  NEW: {
    label: 'M\u1edbi',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  PROCESSING: {
    label: '\u0110ang x\u1eed l\u00fd',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  },
  COMPLETED: {
    label: 'Ho\u00e0n th\u00e0nh',
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  },
  FAILED: {
    label: 'L\u1ed7i',
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-50 text-gray-700' };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        config.className
      )}
    >
      <span className={cn(
        'mr-1.5 h-1.5 w-1.5 rounded-full',
        status === 'NEW' && 'bg-emerald-500',
        status === 'PROCESSING' && 'bg-amber-500',
        status === 'COMPLETED' && 'bg-blue-500',
        status === 'FAILED' && 'bg-red-500',
      )} />
      {config.label}
    </span>
  );
}
