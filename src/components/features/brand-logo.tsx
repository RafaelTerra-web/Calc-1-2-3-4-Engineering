import Image from "next/image";
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
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/30 bg-background shadow-sm shadow-primary/20">
        <Image
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
          height={88}
          priority
          sizes="44px"
          src="/brand-icon.png"
          width={88}
        />
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
