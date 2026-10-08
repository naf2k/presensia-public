import { useQuery } from "@tanstack/react-query";
import {
  getAttendanceDetail,
  getAttendanceMonth,
  getJournalRevisions,
  getJournals,
  getLeaveRequests,
  getParticipantContext,
  getTodayData,
} from "./api";

export const queryKeys = {
  context: ["participant-context"] as const,
  today: ["today"] as const,
  journals: (month?: string) => ["journals", month ?? "all"] as const,
  journalRevisions: (journalId: string) => ["journal-revisions", journalId] as const,
  leaves: ["leaves"] as const,
  attendanceMonth: (month: string) => ["attendance", "month", month] as const,
  attendanceDetail: (id: string) => ["attendance", "detail", id] as const,
};

export function useParticipantContext() {
  return useQuery({ queryKey: queryKeys.context, queryFn: getParticipantContext });
}

export function useToday() {
  return useQuery({ queryKey: queryKeys.today, queryFn: getTodayData });
}

export function useJournals(month?: string) {
  return useQuery({
    queryKey: queryKeys.journals(month),
    queryFn: () => getJournals(month),
  });
}

export function useJournalRevisions(journalId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.journalRevisions(journalId ?? ""),
    queryFn: () => getJournalRevisions(journalId as string),
    enabled: Boolean(journalId),
  });
}

export function useLeaves() {
  return useQuery({ queryKey: queryKeys.leaves, queryFn: getLeaveRequests });
}

export function useAttendanceMonth(month: string) {
  return useQuery({
    queryKey: queryKeys.attendanceMonth(month),
    queryFn: () => getAttendanceMonth(month),
  });
}

export function useAttendanceDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.attendanceDetail(id),
    queryFn: () => getAttendanceDetail(id),
    enabled: Boolean(id),
  });
}
