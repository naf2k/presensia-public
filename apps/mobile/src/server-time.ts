import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type OperationalContext = {
  serverNow: string;
  operationalDate: string;
  timezone: string;
  isWorkDay: boolean;
  checkInTime: string;
  checkOutTime: string;
  lateToleranceMinutes: number;
};

export const clockKeys = {
  context: ["operational-context"] as const,
};

export async function getOperationalContext(): Promise<OperationalContext> {
  const { data, error } = await supabase.rpc("operational_context");
  if (error) throw error;
  const context = data as OperationalContext;
  if (!context?.serverNow || !context?.operationalDate) {
    throw new Error("INVALID_CLOCK");
  }
  return context;
}

export function useOperationalContext() {
  return useQuery({
    queryKey: clockKeys.context,
    queryFn: getOperationalContext,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Device-independent clock: server timestamp plus locally elapsed time.
 * Survives device clock manipulation between resyncs.
 */
export function useServerNow(tickMs = 30_000): Date {
  const context = useOperationalContext();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);
  const serverMs = context.data ? Date.parse(context.data.serverNow) : NaN;
  const fetchedAt = context.dataUpdatedAt || Date.now();
  void tick;
  if (!Number.isFinite(serverMs)) return new Date();
  return new Date(serverMs + Math.max(0, Date.now() - fetchedAt));
}
