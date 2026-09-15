import { describe, expect, it } from "vitest";
import { runFinishJobChecks } from "./preflight";

describe("finish job preflight", () => {
  it("blocks an empty order", () => {
    const result = runFinishJobChecks({ orderId: "order-1", descriptionLength: 40, billableEntryCount: 0, hasBeforeImage: false, hasAfterImage: false, unattachedReceiptCount: 0 });
    expect(result).toContainEqual(expect.objectContaining({ code: "NO_BILLABLE_ENTRIES", severity: "BLOCKING", canOverride: false }));
  });

  it("returns structured warnings without inventing invoice lines", () => {
    const result = runFinishJobChecks({ orderId: "order-1", descriptionLength: 8, billableEntryCount: 2, hasBeforeImage: true, hasAfterImage: false, unattachedReceiptCount: 1 });
    expect(result.map((check) => check.code)).toEqual(["SHORT_WORK_DESCRIPTION", "MISSING_AFTER_IMAGE", "UNATTACHED_RECEIPT"]);
  });
});
