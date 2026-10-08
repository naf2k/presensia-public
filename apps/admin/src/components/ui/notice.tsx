import type * as React from "react";
import { cn } from "@presensia/utils";
import { Icon } from "./icon";

export function Notice({
  tone,
  title,
  children,
}: {
  tone: "info" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("notice", tone === "info" ? "notice-info" : "notice-warning")} role="note">
      <Icon name={tone === "info" ? "info" : "peringatan"} />
      <div>
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}
