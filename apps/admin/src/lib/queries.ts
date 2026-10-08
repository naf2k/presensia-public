"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminApi,
  type AdminSettings,
  type AttendanceFilter,
  type AuditFilter,
  type ImportBatchInput,
  type InstitutionInput,
  type JournalFilter,
  type LeaveFilter,
  type InstitutionDaySchedule,
  type ParticipantFilter,
  type ParticipantInput,
} from "./admin-api";

export const adminKeys = {
  clock: ["admin", "operational-context"] as const,
  holidays: ["admin", "holidays"] as const,
  dashboard: ["admin", "dashboard"] as const,
  institutions: ["admin", "institutions"] as const,
  participants: ["admin", "participants"] as const,
  participant: (id: string) => ["admin", "participant", id] as const,
  attendance: ["admin", "attendance"] as const,
  attendanceDetail: (id: string) => ["admin", "attendance-detail", id] as const,
  journals: ["admin", "journals"] as const,
  leaves: ["admin", "leaves"] as const,
  audits: ["admin", "audits"] as const,
  settings: ["admin", "settings"] as const,
};

export function useOperationalContext() {
  return useQuery({
    queryKey: adminKeys.clock,
    queryFn: () => adminApi.operationalContext(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useDashboard() {
  return useQuery({ queryKey: adminKeys.dashboard, queryFn: () => adminApi.dashboard() });
}

export function useHolidays() {
  return useQuery({ queryKey: adminKeys.holidays, queryFn: () => adminApi.holidays() });
}

export function useSaveHoliday() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string; name: string }) =>
      adminApi.addHoliday(input.date, input.name),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: adminKeys.holidays });
    },
  });
}

export function useRemoveHoliday() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => adminApi.removeHoliday(date),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: adminKeys.holidays });
    },
  });
}

export function useCreateAttendance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createAttendance,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminKeys.dashboard }),
        client.invalidateQueries({ queryKey: adminKeys.attendance }),
        client.invalidateQueries({ queryKey: adminKeys.audits }),
      ]);
    },
  });
}

export function useCleanupOrphans() {
  return useMutation({
    mutationFn: () => adminApi.cleanupOrphans(),
  });
}

export function useCloseDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => adminApi.closeDay(date),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminKeys.dashboard }),
        client.invalidateQueries({ queryKey: adminKeys.attendance }),
        client.invalidateQueries({ queryKey: adminKeys.audits }),
      ]);
    },
  });
}

export function useInstitutions() {
  return useQuery({ queryKey: adminKeys.institutions, queryFn: () => adminApi.institutions() });
}

export function useInstitutionsAll() {
  return useQuery({
    queryKey: [...adminKeys.institutions, "all"],
    queryFn: () => adminApi.institutionsAll(),
  });
}

export function useSaveInstitution() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: InstitutionInput) => adminApi.saveInstitution(input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminKeys.institutions }),
        client.invalidateQueries({ queryKey: adminKeys.participants }),
        client.invalidateQueries({ queryKey: adminKeys.dashboard }),
      ]);
    },
  });
}

export function useSchedules(institutionId: string | undefined) {
  return useQuery({
    queryKey: [...adminKeys.institutions, "schedules", institutionId ?? ""],
    queryFn: () => adminApi.listSchedules(institutionId as string),
    enabled: Boolean(institutionId),
  });
}

export function useSaveSchedules() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { institutionId: string; rows: InstitutionDaySchedule[] }) =>
      adminApi.saveSchedules(input.institutionId, input.rows),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: adminKeys.institutions });
    },
  });
}

export function useParticipants(filter: ParticipantFilter, page: number, perPage = 20) {
  return useQuery({
    queryKey: [...adminKeys.participants, filter, page, perPage],
    queryFn: () => adminApi.participants(filter, page, perPage),
  });
}

export function useParticipant(id: string) {
  return useQuery({
    queryKey: adminKeys.participant(id),
    queryFn: () => adminApi.participant(id),
    enabled: Boolean(id),
  });
}

export function useAttendance(filter: AttendanceFilter, page: number, perPage = 20) {
  return useQuery({
    queryKey: [...adminKeys.attendance, filter, page, perPage],
    queryFn: () => adminApi.attendance(filter, page, perPage),
  });
}

export function useAttendanceDetail(id: string) {
  return useQuery({
    queryKey: adminKeys.attendanceDetail(id),
    queryFn: () => adminApi.attendanceDetail(id),
    enabled: Boolean(id),
  });
}

export function useJournals(filter: JournalFilter, page: number, perPage = 20) {
  return useQuery({
    queryKey: [...adminKeys.journals, filter, page, perPage],
    queryFn: () => adminApi.journals(filter, page, perPage),
  });
}

export function useLeaves(filter: LeaveFilter) {
  return useQuery({
    queryKey: [...adminKeys.leaves, filter],
    queryFn: () => adminApi.leaves(filter),
  });
}

export function useAuditLogs(filter: AuditFilter, page: number, perPage = 20) {
  return useQuery({
    queryKey: [...adminKeys.audits, filter, page, perPage],
    queryFn: () => adminApi.auditLogs(filter, page, perPage),
  });
}

export function useSettings() {
  return useQuery({ queryKey: adminKeys.settings, queryFn: () => adminApi.settings() });
}

export function useSignedUrl(
  bucket: "attendance-photos" | "leave-attachments" | "avatars",
  path: string | null,
) {
  return useQuery({
    queryKey: ["admin", "signed-url", bucket, path],
    queryFn: () => adminApi.signedUrl(bucket, path!),
    enabled: Boolean(path),
    staleTime: 4 * 60_000,
  });
}

export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (next: AdminSettings) => adminApi.saveSettings(next),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminKeys.settings }),
        client.invalidateQueries({ queryKey: adminKeys.dashboard }),
        client.invalidateQueries({ queryKey: adminKeys.audits }),
      ]);
    },
  });
}

export function useReviewLeave() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; decision: "APPROVED" | "REJECTED"; adminNote: string }) =>
      adminApi.reviewLeave(input.id, input.decision, input.adminNote),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminKeys.leaves }),
        client.invalidateQueries({ queryKey: adminKeys.attendance }),
        client.invalidateQueries({ queryKey: adminKeys.dashboard }),
        client.invalidateQueries({ queryKey: adminKeys.audits }),
      ]);
    },
  });
}

export function useSaveCorrection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: adminApi.saveCorrection,
    onSuccess: async (_data, input) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminKeys.attendance }),
        client.invalidateQueries({ queryKey: adminKeys.attendanceDetail(input.id) }),
        client.invalidateQueries({ queryKey: adminKeys.dashboard }),
        client.invalidateQueries({ queryKey: adminKeys.participants }),
        client.invalidateQueries({ queryKey: adminKeys.audits }),
      ]);
    },
  });
}

export function useSaveParticipant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ParticipantInput) => adminApi.saveParticipant(input),
    onSuccess: async (result) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminKeys.participants }),
        client.invalidateQueries({ queryKey: adminKeys.participant(result.id) }),
        client.invalidateQueries({ queryKey: adminKeys.dashboard }),
        client.invalidateQueries({ queryKey: adminKeys.audits }),
      ]);
    },
  });
}

export function useImportParticipants() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportBatchInput) => adminApi.importParticipants(input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminKeys.participants }),
        client.invalidateQueries({ queryKey: adminKeys.dashboard }),
        client.invalidateQueries({ queryKey: adminKeys.audits }),
        client.invalidateQueries({ queryKey: adminKeys.institutions }),
      ]);
    },
  });
}
