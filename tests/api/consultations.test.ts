import { beforeAll, describe, expect, it } from "vitest";
import { SEED_PASSWORD, api, booking, future, newStudent, signIn } from "./helpers";

/**
 * End-to-end tests for the REST API: real HTTP, real sessions, real database.
 * Each run signs up its own students, so it never depends on or disturbs the
 * seed data. Status codes covered: 200, 201, 400, 401, 403, 404, 409, 415, 422.
 */

let student: { email: string; cookie: string };
let otherStudent: { email: string; cookie: string };
let admin: string;

beforeAll(async () => {
  [student, otherStudent, admin] = await Promise.all([
    newStudent(),
    newStudent(),
    signIn("admin@example.com", SEED_PASSWORD),
  ]);
});

const NOT_FOUND_ID = "00000000-0000-0000-0000-000000000000";

describe("authentication (401)", () => {
  it.each([
    ["GET", "/api/consultations"],
    ["POST", "/api/consultations"],
    ["PATCH", `/api/consultations/${NOT_FOUND_ID}`],
    ["GET", "/api/admin/consultations"],
    ["GET", `/api/admin/consultations/${NOT_FOUND_ID}`],
  ])("%s %s without a session is 401", async (method, path) => {
    const res = await api(method, path, method === "GET" ? {} : { json: {} });
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe("unauthorized");
  });
});

describe("every response", () => {
  it("returns a request id, and reuses a valid incoming one", async () => {
    const generated = await api("GET", "/api/consultations");
    expect(generated.headers.get("x-request-id")).toMatch(/^[\w-]{8,64}$/);

    const reused = await api("GET", "/api/consultations", {
      headers: { "x-request-id": "trace-abc-12345" },
    });
    expect(reused.headers.get("x-request-id")).toBe("trace-abc-12345");
  });
});

describe("booking (POST /api/consultations)", () => {
  it("201: creates a consultation for the signed-in student", async () => {
    const res = await api("POST", "/api/consultations", {
      cookie: student.cookie,
      json: booking(future(10)),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("location")).toBe(`/api/consultations/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      firstName: "Api",
      lastName: "Test",
      status: "scheduled",
      completed: false,
    });
  });

  it("400: missing fields come back as field errors", async () => {
    const res = await api("POST", "/api/consultations", { cookie: student.cookie, json: {} });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("validation_error");
    expect(res.body.error?.details).toMatchObject({
      fieldErrors: expect.objectContaining({ firstName: expect.any(Array) }),
    });
  });

  it("400: a time in the past is rejected", async () => {
    const res = await api("POST", "/api/consultations", {
      cookie: student.cookie,
      json: booking(future(-1)),
    });
    expect(res.status).toBe(400);
  });

  it("400: unknown fields such as student_id are rejected (can't book for someone else)", async () => {
    const res = await api("POST", "/api/consultations", {
      cookie: student.cookie,
      json: { ...booking(future(11)), studentId: NOT_FOUND_ID },
    });
    expect(res.status).toBe(400);
  });

  it("400: malformed JSON", async () => {
    const res = await api("POST", "/api/consultations", {
      cookie: student.cookie,
      rawBody: "{not json",
    });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("invalid_json");
  });

  it("415: non-JSON content type (CSRF guard)", async () => {
    const res = await api("POST", "/api/consultations", {
      cookie: student.cookie,
      rawBody: "firstName=A",
      contentType: "application/x-www-form-urlencoded",
    });
    expect(res.status).toBe(415);
  });

  it("409: the same student can't double-book a time", async () => {
    const when = future(12);
    const first = await api("POST", "/api/consultations", {
      cookie: student.cookie,
      json: booking(when),
    });
    expect(first.status).toBe(201);
    const second = await api("POST", "/api/consultations", {
      cookie: student.cookie,
      json: booking(when),
    });
    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe("conflict");
  });
});

describe("listing (GET /api/consultations)", () => {
  it("200: a student sees only their own consultations", async () => {
    await api("POST", "/api/consultations", {
      cookie: otherStudent.cookie,
      json: booking(future(13), { reason: "Other student's booking" }),
    });

    const mine = await api("GET", "/api/consultations", { cookie: student.cookie });
    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBeGreaterThan(0);
    expect(
      mine.body.data.some((c: { reason: string }) => c.reason === "Other student's booking"),
    ).toBe(false);
  });
});

describe("changing a consultation (PATCH /api/consultations/:id)", () => {
  let id: string;

  beforeAll(async () => {
    const res = await api("POST", "/api/consultations", {
      cookie: student.cookie,
      json: booking(future(14)),
    });
    id = res.body.data.id;
  });

  const patch = (json: unknown, cookie = student.cookie, target = id) =>
    api("PATCH", `/api/consultations/${target}`, { cookie, json });

  it("400: more than one change in a request", async () => {
    expect((await patch({ completed: true, status: "cancelled" })).status).toBe(400);
  });

  it("400: an id that isn't a UUID", async () => {
    expect((await patch({ completed: true }, student.cookie, "not-a-uuid")).status).toBe(400);
  });

  it("404: a consultation that doesn't exist", async () => {
    expect((await patch({ completed: true }, student.cookie, NOT_FOUND_ID)).status).toBe(404);
  });

  it("404: another student's consultation (not 403, so ids can't be probed)", async () => {
    expect((await patch({ completed: true }, otherStudent.cookie)).status).toBe(404);
  });

  it("200 then 422: complete, and a completed consultation can't be rescheduled", async () => {
    const done = await patch({ completed: true });
    expect(done.status).toBe(200);
    expect(done.body.data.completed).toBe(true);

    const reschedule = await patch({ scheduledAt: future(15) });
    expect(reschedule.status).toBe(422);
    expect(reschedule.body.error?.code).toBe("rule_violation");
  });

  it("200: mark incomplete, then reschedule", async () => {
    expect((await patch({ completed: false })).status).toBe(200);
    const when = future(16);
    const res = await patch({ scheduledAt: when });
    expect(res.status).toBe(200);
    expect(Date.parse(res.body.data.scheduledAt)).toBe(Date.parse(when));
  });

  it("200 then 422: cancel, and a cancelled consultation is final", async () => {
    const cancelled = await patch({ status: "cancelled" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("cancelled");
    expect(cancelled.body.data.cancelledAt).toEqual(expect.any(String));

    expect((await patch({ completed: true })).status).toBe(422);
  });
});

describe("roles (403)", () => {
  it.each([
    ["GET", "/api/consultations"],
    ["POST", "/api/consultations"],
    ["PATCH", `/api/consultations/${NOT_FOUND_ID}`],
  ])("an admin can't use the student route %s %s", async (method, path) => {
    const res = await api(method, path, {
      cookie: admin,
      ...(method === "GET" ? {} : { json: booking(future(20)) }),
    });
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("forbidden");
  });

  it.each([["/api/admin/consultations"], [`/api/admin/consultations/${NOT_FOUND_ID}`]])(
    "a student can't use the admin route %s",
    async (path) => {
      expect((await api("GET", path, { cookie: student.cookie })).status).toBe(403);
    },
  );
});

describe("admin (read-only)", () => {
  it("200: lists consultations across all students, paginated", async () => {
    const res = await api("GET", "/api/admin/consultations?pageSize=5", { cookie: admin });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 5 });
    expect(res.body.data[0]).toHaveProperty("studentEmail");
  });

  it("200: filters by status", async () => {
    const res = await api("GET", "/api/admin/consultations?status=cancelled", { cookie: admin });
    expect(res.status).toBe(200);
    expect(res.body.data.every((c: { status: string }) => c.status === "cancelled")).toBe(true);
  });

  it("400: page size above the cap", async () => {
    const res = await api("GET", "/api/admin/consultations?pageSize=1000", { cookie: admin });
    expect(res.status).toBe(400);
  });

  it("200: one consultation with the student's account and other bookings", async () => {
    const created = await api("POST", "/api/consultations", {
      cookie: student.cookie,
      json: booking(future(21), { reason: "Detail view check" }),
    });
    const res = await api("GET", `/api/admin/consultations/${created.body.data.id}`, {
      cookie: admin,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      reason: "Detail view check",
      studentEmail: student.email,
    });
    // The student booked several consultations earlier in this run.
    expect(res.body.data.otherConsultations.length).toBeGreaterThan(0);
  });

  it("404 and 400: missing and malformed ids", async () => {
    expect(
      (await api("GET", `/api/admin/consultations/${NOT_FOUND_ID}`, { cookie: admin })).status,
    ).toBe(404);
    expect((await api("GET", "/api/admin/consultations/nope", { cookie: admin })).status).toBe(400);
  });
});
