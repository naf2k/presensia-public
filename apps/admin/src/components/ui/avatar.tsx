import { cn } from "@presensia/utils";

const VARIANTS = ["av-pine", "av-amber", "av-slate", "av-rose"] as const;

function variantFor(name: string): (typeof VARIANTS)[number] {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return VARIANTS[hash % VARIANTS.length] ?? "av-pine";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase();
}

export function Avatar({
  name,
  variant,
  className,
}: {
  name: string;
  variant?: (typeof VARIANTS)[number];
  className?: string;
}) {
  return (
    <span className={cn("avatar", variant ?? variantFor(name), className)} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
