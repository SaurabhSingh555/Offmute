import { describe, expect, it } from "vitest";
import {
  generateHandle,
  handleIsValid,
  hashStr,
  isValidImageFile,
  pollPercents,
  slugify,
  timeAgo,
} from "../utils";

describe("generateHandle", () => {
  it("produces CamelCase word + 2 digit handles", () => {
    for (let i = 0; i < 200; i++) {
      const h = generateHandle();
      expect(h).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
    }
  });

  it("produces a healthy spread of unique handles", () => {
    const set = new Set<string>();
    for (let i = 0; i < 300; i++) set.add(generateHandle());
    expect(set.size).toBeGreaterThan(150);
  });

  it("is deterministic with a seeded rand", () => {
    const rand = (() => {
      let v = 0.42;
      return () => {
        v = (v * 9301 + 49297) % 233280;
        return v / 233280;
      };
    })();
    const a = generateHandle(rand);
    const b = generateHandle(rand);
    expect(a).not.toBe(b); // successive draws differ
    expect(a).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
  });
});

describe("handleIsValid", () => {
  it("accepts valid handles", () => {
    expect(handleIsValid("SilentPanda47")).toBe(true);
    expect(handleIsValid("a_b_c")).toBe(true);
  });
  it("rejects invalid handles", () => {
    expect(handleIsValid("1abc")).toBe(false);
    expect(handleIsValid("ab")).toBe(false);
    expect(handleIsValid("way_too_long_handle_here_123456")).toBe(false);
    expect(handleIsValid("has space")).toBe(false);
    expect(handleIsValid("dashes-here")).toBe(false);
  });
});

describe("slugify", () => {
  it("lowercases, dashes and trims", () => {
    expect(slugify("Noida Corporate 62!")).toBe("noida-corporate-62");
    expect(slugify("  Bengaluru   Tech ")).toBe("bengaluru-tech");
  });
  it("caps length", () => {
    expect(slugify("a".repeat(100)).length).toBe(48);
  });
});

describe("hashStr", () => {
  it("is stable for the same handle (stable avatars)", () => {
    expect(hashStr("NightShiftFox")).toBe(hashStr("NightShiftFox"));
    expect(hashStr("NightShiftFox")).not.toBe(hashStr("SilentPanda"));
  });
  it("returns unsigned 32-bit ints", () => {
    expect(hashStr("x")).toBeGreaterThanOrEqual(0);
    expect(hashStr("x")).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("pollPercents", () => {
  it("computes percentages", () => {
    expect(pollPercents([1, 1])).toEqual([50, 50]);
    expect(pollPercents([3, 1])).toEqual([75, 25]);
  });
  it("handles zero totals", () => {
    expect(pollPercents([0, 0])).toEqual([0, 0]);
    expect(pollPercents([])).toEqual([]);
  });
});

describe("timeAgo", () => {
  it("formats recent times", () => {
    expect(timeAgo(new Date(Date.now() - 20_000).toISOString())).toMatch(/s$/);
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe("5m");
    expect(timeAgo(new Date(Date.now() - 3 * 3600_000).toISOString())).toBe("3h");
    expect(timeAgo(new Date(Date.now() - 2 * 86400_000).toISOString())).toBe("2d");
  });
});

describe("isValidImageFile", () => {
  it("accepts small images", () => {
    const f = new File(["x"], "a.png", { type: "image/png" });
    expect(isValidImageFile(f).ok).toBe(true);
  });
  it("rejects non-images", () => {
    const f = new File(["x"], "a.pdf", { type: "application/pdf" });
    expect(isValidImageFile(f).ok).toBe(false);
  });
  it("rejects files over 5MB", () => {
    const f = new File([new Uint8Array(6 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    expect(isValidImageFile(f).ok).toBe(false);
  });
});
