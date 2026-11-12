import { describe, expect, it } from "vitest";
import { suttaFilePath } from "./source-paths";

describe("suttaFilePath — 원래 앱과 같은 파일 위치 규칙", () => {
  it("디가·맛지마는 경 번호 그대로", () => {
    expect(suttaFilePath("dn.22")).toBe("dn22");
    expect(suttaFilePath("mn.10")).toBe("mn10");
  });

  it("상윳따·앙굿따라는 상윳따·집 폴더 아래", () => {
    expect(suttaFilePath("sn.1.1")).toBe("sn1/sn1.1");
    expect(suttaFilePath("an.1.1-10")).toBe("an1/an1.1-10");
  });

  it("쿳다까 니까야 책마다 다른 규칙", () => {
    expect(suttaFilePath("dhp.1-20")).toBe("dhp1-20");
    expect(suttaFilePath("ud.1.1")).toBe("vagga1/ud1.1");
    expect(suttaFilePath("iti.15")).toBe("vagga2/iti15");
    expect(suttaFilePath("thag.1.1")).toBe("thag1.1");
    expect(suttaFilePath("mil.7.8.7")).toBe("mil7.8.7");
  });
});
