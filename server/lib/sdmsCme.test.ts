import { describe, expect, it } from "vitest";
import {
  SDMS_PAYLOAD_FIELD_NAMES,
  SDMS_SUCCESS_CODE,
  buildSdmsPayload,
  formatSdmsDate,
  parseSdmsResponseCode,
  validateSdmsPayload,
  zeroCreditPayload,
} from "./sdmsCmeApi";
import { computeFormPassFail, extractLearnerFieldsFromForm, validateLearnerFields } from "./sdmsCmeService";
import { decryptSdmsPassword, encryptSdmsPassword, maskCredential } from "./sdmsCmeCredentials";

describe("sdmsCmeApi", () => {
  it("defines exact SDMS payload field names including spaces", () => {
    expect(SDMS_PAYLOAD_FIELD_NAMES).toContain("Approval ID");
    expect(SDMS_PAYLOAD_FIELD_NAMES).toContain("Date Completed");
    expect(SDMS_PAYLOAD_FIELD_NAMES).toContain("Sonography Canada Number");
    expect(SDMS_PAYLOAD_FIELD_NAMES).toContain("Is Speaker");
    expect(SDMS_PAYLOAD_FIELD_NAMES).toHaveLength(23);
  });

  it("builds payload with credit in selected category only", () => {
    const payload = buildSdmsPayload({
      approvalId: "6000246",
      learner: {
        sdmsNumber: "1179424",
        lastName: "User",
        firstName: "SDMS",
        birthDate: "11/08/1969",
        email: "sdmsuser@gmail.com",
        isSpeaker: "N",
      },
      dateCompleted: "03/13/2020",
      creditCategory: "SPI_CME",
      creditAmount: "2.5",
    });
    expect(payload["SPI_CME"]).toBe("2.50");
    expect(payload["AB_CME"]).toBe("0.00");
    expect(payload["Approval ID"]).toBe("6000246");
    expect(payload["Is Speaker"]).toBe("N");
  });

  it("rejects unknown payload keys", () => {
    const payload = buildSdmsPayload({
      approvalId: "1",
      learner: {
        lastName: "L",
        firstName: "F",
        birthDate: "01/01/2000",
        email: "a@b.com",
        isSpeaker: "N",
      },
      dateCompleted: "01/01/2024",
      creditCategory: "SPI_CME",
      creditAmount: "1",
    });
    const bad = { ...payload, approvalId: "1" } as Record<string, unknown>;
    const result = validateSdmsPayload(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("Unknown field"))).toBe(true);
    }
  });

  it("requires all SDMS fields as strings", () => {
    const payload = buildSdmsPayload({
      approvalId: "6000246",
      learner: {
        lastName: "User",
        firstName: "SDMS",
        birthDate: "11/08/1969",
        email: "test@test.com",
        isSpeaker: "N",
      },
      dateCompleted: "03/13/2020",
      creditCategory: "FE_CME",
      creditAmount: "1.00",
    });
    const result = validateSdmsPayload(payload);
    expect(result.ok).toBe(true);
  });

  it("parses SDMS response code 305 as success", () => {
    const parsed = parseSdmsResponseCode("305 - CME Activity Roster Entry – Success");
    expect(parsed.code).toBe(SDMS_SUCCESS_CODE);
  });

  it("formats dates as MM/DD/YYYY", () => {
    expect(formatSdmsDate(new Date(2020, 2, 13))).toBe("03/13/2020");
  });

  it("zero credit payload has all categories", () => {
    const z = zeroCreditPayload();
    expect(Object.keys(z)).toHaveLength(11);
    expect(z.VT_CME).toBe("0.00");
  });
});

describe("sdmsCmeService pass/fail", () => {
  it("passes when score meets threshold", () => {
    const r = computeFormPassFail({ score: 8, maxScore: 10, passingScorePercent: "70" });
    expect(r.passed).toBe(true);
    expect(r.passStatus).toBe("passed");
  });

  it("fails when below threshold", () => {
    const r = computeFormPassFail({ score: 6, maxScore: 10, passingScorePercent: "70" });
    expect(r.passed).toBe(false);
    expect(r.passStatus).toBe("failed");
  });

  it("supports manual override pass", () => {
    const r = computeFormPassFail({
      score: 0,
      maxScore: 10,
      passingScorePercent: "70",
      manualOverride: "override_pass",
    });
    expect(r.passed).toBe(true);
    expect(r.passStatus).toBe("override_pass");
  });
});

describe("learner field extraction", () => {
  it("maps form labels to SDMS fields", () => {
    const fields = extractLearnerFieldsFromForm(
      { "1": "Jane", "2": "Doe", "3": "jane@example.com" },
      [
        { id: 1, label: "First Name" },
        { id: 2, label: "Last Name" },
        { id: 3, label: "Email Address" },
      ],
      {}
    );
    expect(fields.FirstName).toBe("Jane");
    expect(fields.LastName).toBe("Doe");
    expect(fields.Email).toBe("jane@example.com");
  });

  it("validates required learner fields", () => {
    expect(validateLearnerFields({})).toHaveLength(4);
    expect(
      validateLearnerFields({
        FirstName: "A",
        LastName: "B",
        Email: "c@d.com",
        BirthDate: "01/01/1990",
      })
    ).toHaveLength(0);
  });
});

describe("sdmsCmeCredentials", () => {
  it("encrypts and decrypts password round-trip", () => {
    const enc = encryptSdmsPassword("secret-pass");
    expect(enc).not.toContain("secret-pass");
    expect(decryptSdmsPassword(enc)).toBe("secret-pass");
  });

  it("masks credentials for admin display", () => {
    expect(maskCredential("myusername")).toMatch(/\*/);
    expect(maskCredential("")).toBe("");
  });
});
