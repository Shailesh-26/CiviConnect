import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-ink/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card flex items-center gap-4 p-4">
          <Skeleton className="size-12 !rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="hidden h-6 w-20 !rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center animate-fade">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <Icon size={26} aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-ink/60">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert">
      {children}
    </p>
  );
}
