import { describe, expect, it } from "vitest";
import { dailyNumber, suttaLabel } from "@/lib/format";

describe("suttaLabel", () => {
  it("경 번호를 읽기 좋게", () => {
    expect(suttaLabel("dn22")).toBe("DN 22");
    expect(suttaLabel("dhp1-20")).toBe("DHP 1-20");
  });
});

describe("dailyNumber", () => {
  it("같은 날에는 시각이 달라도 같은 번호", () => {
    expect(dailyNumber(new Date(2026, 10, 3, 0, 1), 423)).toBe(
      dailyNumber(new Date(2026, 10, 3, 23, 59), 423),
    );
  });

  it("다음 날은 다음 번호, 끝에서는 1로 돌아간다", () => {
    const today = dailyNumber(new Date(2026, 10, 3), 423);
    const tomorrow = dailyNumber(new Date(2026, 10, 4), 423);
    expect(tomorrow).toBe(today === 423 ? 1 : today + 1);
  });

  it("항상 1 ~ count 안", () => {
    for (let d = 0; d < 900; d += 7) {
      const n = dailyNumber(new Date(2026, 0, 1 + d), 423);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(423);
    }
  });
});
