import { describe, expect, it } from "vitest";
import { assertBelongsToTenant, requireRole } from "./tenant-context";

const context = { organizationId: "org-a", userId: "user-1", role: "USER" as const };

describe("tenant authorization", () => {
  it("rejects cross-tenant records", () => {
    expect(() => assertBelongsToTenant(context, { organizationId: "org-b" })).toThrow(/Cross-organization/);
  });

  it("rejects insufficient roles", () => {
    expect(() => requireRole(context, "ADMIN")).toThrow(/requiring ADMIN/);
  });
});
