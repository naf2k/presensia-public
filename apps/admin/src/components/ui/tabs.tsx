import Link from "next/link";
import { cn } from "@presensia/utils";

export interface TabItem {
  href: string;
  label: string;
  count?: number;
  active?: boolean;
}

export function Tabs({ items }: { items: TabItem[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          role="tab"
          aria-selected={item.active}
          className={cn("tab", item.active && "is-active")}
        >
          {item.label}
          {item.count !== undefined ? <span className="tab-count">{item.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}
