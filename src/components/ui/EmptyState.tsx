import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 text-ash-600">{icon}</div>
      )}
      <p className="heading-fantasy text-ash-300 text-base mb-1">{title}</p>
      {description && (
        <p className="text-ash-500 text-sm max-w-xs leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  );
}
