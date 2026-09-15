import { describe, expect, it } from "vitest";
import { createKid } from "./kid";
describe("KID", () => { it("creates a valid Mod10 check digit", () => { expect(createKid(1001)).toBe("10017"); }); });
