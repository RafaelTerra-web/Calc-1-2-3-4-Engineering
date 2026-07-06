import { cn } from "@/lib/utils";

export function BrandLogo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/30 bg-primary text-primary-foreground shadow-sm shadow-primary/20">
        <svg
          aria-hidden="true"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 48 48"
        >
          <path
            d="M9 33.5 18.5 14l8.6 20.5L34.5 20H40"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M13 36h22"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M30 12h8M34 8v8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          <circle cx="18.5" cy="14" fill="currentColor" r="2.3" />
          <circle cx="27.1" cy="34.5" fill="currentColor" r="2.3" />
        </svg>
        <span className="absolute bottom-0 left-0 h-1 w-full bg-[var(--brand-warm)]" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Engenharia UERJ
          </p>
          <p className="truncate text-lg font-semibold">Cálculo em Foco</p>
        </div>
      )}
    </div>
  );
}
