import { cn } from "@presensia/utils";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return cn(...parts);
}
