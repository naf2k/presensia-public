import assert from "node:assert/strict";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && anonKey && serviceRoleKey, "Supabase test environment is incomplete");

// Safety guard: this script wipes journals, attendance, leave, and audit
// rows. It must never run against the production project.
const PRODUCTION_REF = "YOUR_PROD_PROJECT_REF";
assert(
  !url.includes(PRODUCTION_REF) || process.env.ALLOW_PROD_DESTRUCTIVE_TEST === "1",
  "Refusing to run the destructive cloud test against the production project. Point SUPABASE_URL at a staging project instead.",
);

const ids = {
  admin: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  participantOne: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  participantTwo: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  internshipOne: "33333333-3333-4333-8333-333333333333",
  internshipTwo: "44444444-4444-4444-8444-444444444444",
};
const password = `CloudTest-${Date.now()}-Aa9`;
const operationalDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

let passed = 0;
function pass(name) {
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

async function request(path, { method = "GET", token, key = anonKey, body, headers = {} } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined || body instanceof Uint8Array
        ? {}
        : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON responses are retained for status assertions.
  }
  return { response, data };
}

async function admin(path, options = {}) {
  return request(path, { ...options, key: serviceRoleKey, token: serviceRoleKey });
}

async function resetPassword(id) {
  const { response, data } = await admin(`/auth/v1/admin/users/${id}`, {
    method: "PUT",
    body: { password, email_confirm: true },
  });
  assert.equal(response.status, 200, `Unable to prepare test user: ${JSON.stringify(data)}`);
}

async function signIn(email) {
  const { response, data } = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(response.status, 200, `Sign-in failed for ${email}: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function functionCall(name, token, body) {
  return request(`/functions/v1/${name}`, { method: "POST", token, body });
}

function nextWorkday(after = operationalDate) {
  const date = new Date(`${after}T12:00:00+07:00`);
  do date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

for (const table of ["journals", "attendance_records", "leave_requests", "audit_logs"]) {
  const { response } = await admin(`/rest/v1/${table}?id=not.is.null`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  assert.ok(response.ok, `Failed to clean ${table}`);
}

await Promise.all([
  resetPassword(ids.admin),
  resetPassword(ids.participantOne),
  resetPassword(ids.participantTwo),
]);
const [adminToken, participantOneToken, participantTwoToken] = await Promise.all([
  signIn("admin@presensia.test"),
  signIn("participant.one@presensia.test"),
  signIn("participant.two@presensia.test"),
]);
pass("seeded admin and participant users authenticate");

const signup = await request("/auth/v1/signup", {
  method: "POST",
  body: { email: "public.signup@presensia.test", password },
});
assert.ok(signup.response.status >= 400);
pass("public registration is disabled");

const ownProfiles = await request("/rest/v1/profiles?select=id", { token: participantOneToken });
assert.equal(ownProfiles.response.status, 200);
assert.deepEqual(
  ownProfiles.data.map((row) => row.id),
  [ids.participantOne],
);
const adminProfiles = await request("/rest/v1/profiles?select=id", { token: adminToken });
assert.equal(adminProfiles.data.length, 3);
pass("profile RLS isolates participant and allows admin read");

const participantAdminCall = await functionCall("update-attendance-settings", participantOneToken, {
  workDays: [1, 2, 3, 4, 5],
  checkInTime: "08:00",
  lateToleranceMinutes: 15,
  checkOutTime: "16:00",
  locationName: "Lokasi Fiktif Pengujian",
  latitude: 0.123456,
  longitude: 100.654321,
  radiusMeters: 150,
  maxLocationAccuracyMeters: 100,
  requireCheckoutPhoto: false,
  maxJournalLength: 500,
});
assert.equal(participantAdminCall.response.status, 403);
pass("participant cannot invoke admin operation");

const adminSettingsCall = await functionCall("update-attendance-settings", adminToken, {
  workDays: [1, 2, 3, 4, 5],
  checkInTime: "08:00",
  lateToleranceMinutes: 15,
  checkOutTime: "16:00",
  locationName: "Lokasi Fiktif Pengujian",
  latitude: 0.123456,
  longitude: 100.654321,
  radiusMeters: 150,
  maxLocationAccuracyMeters: 100,
  requireCheckoutPhoto: false,
  maxJournalLength: 500,
});
assert.equal(adminSettingsCall.response.status, 200, JSON.stringify(adminSettingsCall.data));
const settingsAudit = await request(
  "/rest/v1/audit_logs?select=action&action=eq.ATTENDANCE_SETTINGS_UPDATED",
  { token: adminToken },
);
assert.equal(settingsAudit.data.length, 1);
pass("admin settings update is persisted and audited");

const photoPaths = {
  one: `${ids.participantOne}/${operationalDate}/check-in-${Date.now()}.png`,
  two: `${ids.participantTwo}/${operationalDate}/check-in-${Date.now()}.png`,
};
for (const [token, path] of [
  [participantOneToken, photoPaths.one],
  [participantTwoToken, photoPaths.two],
]) {
  const upload = await request(`/storage/v1/object/attendance-photos/${path}`, {
    method: "POST",
    token,
    body: png,
    headers: { "Content-Type": "image/png", "x-upsert": "false" },
  });
  assert.ok(upload.response.ok, `Photo upload failed: ${JSON.stringify(upload.data)}`);
}
pass("participants can upload attendance evidence only to private own-prefix paths");

const crossPrefixUpload = await request(
  `/storage/v1/object/attendance-photos/${ids.participantTwo}/${operationalDate}/forbidden-${Date.now()}.png`,
  {
    method: "POST",
    token: participantOneToken,
    body: png,
    headers: { "Content-Type": "image/png", "x-upsert": "false" },
  },
);
assert.ok(crossPrefixUpload.response.status >= 400);
pass("storage RLS rejects uploads into another participant prefix");

const publicPhoto = await request(`/storage/v1/object/public/attendance-photos/${photoPaths.one}`);
assert.notEqual(publicPhoto.response.status, 200);
pass("attendance evidence has no public access");

const outside = await functionCall("check-in", participantTwoToken, {
  photoPath: photoPaths.two,
  latitude: 1.123456,
  longitude: 100.654321,
  accuracyMeters: 10,
});
assert.equal(outside.response.status, 422);
assert.equal(outside.data.error.code, "LOCATION_OUTSIDE_RADIUS");
pass("server rejects location outside configured radius");

const poorAccuracy = await functionCall("check-in", participantTwoToken, {
  photoPath: photoPaths.two,
  latitude: 0.123456,
  longitude: 100.654321,
  accuracyMeters: 101,
});
assert.equal(poorAccuracy.response.status, 422);
assert.equal(poorAccuracy.data.error.code, "LOCATION_ACCURACY_TOO_LOW");
pass("server rejects inadequate GPS accuracy");

const concurrentCheckIn = await Promise.all([
  functionCall("check-in", participantOneToken, {
    photoPath: photoPaths.one,
    latitude: 0.123456,
    longitude: 100.654321,
    accuracyMeters: 10,
  }),
  functionCall("check-in", participantOneToken, {
    photoPath: photoPaths.one,
    latitude: 0.123456,
    longitude: 100.654321,
    accuracyMeters: 10,
  }),
]);
assert.deepEqual(concurrentCheckIn.map(({ response }) => response.status).sort(), [200, 409]);
const checkInOne = concurrentCheckIn.find(({ response }) => response.status === 200);
assert.ok(checkInOne);
assert.equal(checkInOne.data.attendance.date, operationalDate);
const checkInTwo = await functionCall("check-in", participantTwoToken, {
  photoPath: photoPaths.two,
  latitude: 0.123456,
  longitude: 100.654321,
  accuracyMeters: 10,
});
assert.equal(checkInTwo.response.status, 200, JSON.stringify(checkInTwo.data));
pass("valid location creates server-authoritative attendance");

const oneAttendance = await request(
  `/rest/v1/attendance_records?select=id&participant_id=eq.${ids.participantOne}&attendance_date=eq.${operationalDate}`,
  { token: participantOneToken },
);
assert.equal(oneAttendance.data.length, 1);
pass("database and transaction prevent duplicate concurrent check-in");

const crossAttendance = await request(
  `/rest/v1/attendance_records?select=id&participant_id=eq.${ids.participantTwo}`,
  { token: participantOneToken },
);
assert.deepEqual(crossAttendance.data, []);
pass("attendance RLS blocks another participant's records");

const checkout = await functionCall("check-out", participantOneToken, {
  journalContent: "Jurnal integrasi backend dengan data fiktif.",
});
assert.equal(checkout.response.status, 200, JSON.stringify(checkout.data));
const checkoutWithoutJournal = await functionCall("check-out", participantTwoToken, {});
assert.equal(
  checkoutWithoutJournal.response.status,
  200,
  JSON.stringify(checkoutWithoutJournal.data),
);
const secondCheckout = await functionCall("check-out", participantOneToken, {});
assert.equal(secondCheckout.response.status, 409);
assert.equal(secondCheckout.data.error.code, "ALREADY_CHECKED_OUT");
pass("checkout uses server time, journals remain optional, and duplicate checkout is rejected");

const crossJournal = await request(
  `/rest/v1/journals?select=id&participant_id=eq.${ids.participantOne}`,
  { token: participantTwoToken },
);
assert.deepEqual(crossJournal.data, []);
pass("journal RLS blocks another participant's journal");

const participantAttendanceWrite = await request("/rest/v1/attendance_records", {
  method: "POST",
  token: participantOneToken,
  body: {
    participant_id: ids.participantOne,
    internship_id: ids.internshipOne,
    attendance_date: nextWorkday(),
    status: "TIDAK_HADIR",
    source: "ADMIN_CORRECTION",
  },
});
assert.ok(participantAttendanceWrite.response.status >= 400);
pass("participant cannot directly mutate authoritative attendance");

const correctionWithoutReason = await functionCall("admin-correct-attendance", adminToken, {
  attendanceId: checkInOne.data.attendance.id,
  reason: "",
});
assert.equal(correctionWithoutReason.response.status, 422);
pass("attendance correction rejects an empty reason");

const correction = await functionCall("admin-correct-attendance", adminToken, {
  attendanceId: checkInOne.data.attendance.id,
  reason: "Verifikasi koreksi integrasi backend",
});
assert.equal(correction.response.status, 200, JSON.stringify(correction.data));
const audit = await request(
  `/rest/v1/audit_logs?select=action,before_data,after_data,reason&entity_id=eq.${checkInOne.data.attendance.id}`,
  { token: adminToken },
);
assert.equal(audit.data.length, 1);
assert.equal(audit.data[0].action, "ATTENDANCE_CORRECTED");
assert.ok(audit.data[0].before_data && audit.data[0].after_data && audit.data[0].reason);
pass("admin correction requires reason and atomically records before/after audit");

const futureDate = nextWorkday();
const leaveInsert = await request("/rest/v1/leave_requests?select=id", {
  method: "POST",
  token: participantTwoToken,
  headers: { Prefer: "return=representation" },
  body: {
    participant_id: ids.participantTwo,
    internship_id: ids.internshipTwo,
    type: "IZIN",
    start_date: futureDate,
    end_date: futureDate,
    reason: "Pengajuan izin fiktif untuk pengujian integrasi",
  },
});
assert.equal(leaveInsert.response.status, 201, JSON.stringify(leaveInsert.data));
const leaveId = leaveInsert.data[0].id;
const review = await functionCall("review-leave", adminToken, {
  leaveRequestId: leaveId,
  decision: "APPROVED",
  adminNote: "Disetujui untuk pengujian integrasi",
});
assert.equal(review.response.status, 200, JSON.stringify(review.data));
const leaveAttendance = await request(
  `/rest/v1/attendance_records?select=status,source,leave_request_id&attendance_date=eq.${futureDate}`,
  { token: participantTwoToken },
);
assert.deepEqual(leaveAttendance.data, [
  { status: "IZIN", source: "LEAVE", leave_request_id: leaveId },
]);
const crossLeave = await request(`/rest/v1/leave_requests?select=id&id=eq.${leaveId}`, {
  token: participantOneToken,
});
assert.deepEqual(crossLeave.data, []);
pass("admin-only leave approval materializes attendance and leave RLS isolates participants");

const rejectedDate = nextWorkday(futureDate);
const rejectedLeaveInsert = await request("/rest/v1/leave_requests?select=id", {
  method: "POST",
  token: participantTwoToken,
  headers: { Prefer: "return=representation" },
  body: {
    participant_id: ids.participantTwo,
    internship_id: ids.internshipTwo,
    type: "SAKIT",
    start_date: rejectedDate,
    end_date: rejectedDate,
    reason: "Pengajuan sakit fiktif yang akan ditolak admin",
  },
});
assert.equal(rejectedLeaveInsert.response.status, 201, JSON.stringify(rejectedLeaveInsert.data));
const rejectedReview = await functionCall("review-leave", adminToken, {
  leaveRequestId: rejectedLeaveInsert.data[0].id,
  decision: "REJECTED",
  adminNote: "Ditolak untuk pengujian state transition",
});
assert.equal(rejectedReview.response.status, 200, JSON.stringify(rejectedReview.data));
const rejectedAttendance = await request(
  `/rest/v1/attendance_records?select=id&attendance_date=eq.${rejectedDate}`,
  { token: participantTwoToken },
);
assert.deepEqual(rejectedAttendance.data, []);
pass("rejected leave reaches final state without materializing attendance");

const ownSignedUrl = await functionCall("create-signed-url", participantOneToken, {
  bucket: "attendance-photos",
  path: photoPaths.one,
});
assert.equal(ownSignedUrl.response.status, 200);
assert.equal(ownSignedUrl.data.expiresIn, 300);
const crossSignedUrl = await functionCall("create-signed-url", participantOneToken, {
  bucket: "attendance-photos",
  path: photoPaths.two,
});
assert.equal(crossSignedUrl.response.status, 403);
pass("signed evidence access is short-lived and owner/admin authorized");

const participantAudit = await request("/rest/v1/audit_logs?select=id", {
  token: participantOneToken,
});
assert.deepEqual(participantAudit.data, []);
pass("audit logs are hidden from participants");

console.log(`1..${passed}`);
