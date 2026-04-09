import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { z } from "npm:zod@3";

const requestSchema = z.object({
  type: z.enum(["bug_report", "feature_request"]),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  app_version: z.string().optional(),
  device_model: z.string().optional(),
  os_version: z.string().optional(),
  platform: z.string().optional(),
});

type RequestData = z.infer<typeof requestSchema>;

Deno.test("valid request with all fields", () => {
  const data: RequestData = {
    type: "bug_report",
    title: "App crashes on startup",
    description: "The app crashes immediately when I open it on iOS 17.",
    app_version: "1.0.0",
    device_model: "iPhone 15 Pro",
    os_version: "17.0",
    platform: "ios",
  };
  const result = requestSchema.safeParse(data);
  assertEquals(result.success, true);
});

Deno.test("valid request with only required fields", () => {
  const data: RequestData = {
    type: "feature_request",
    title: "Add dark mode",
    description: "It would be great to have a dark mode option.",
  };
  const result = requestSchema.safeParse(data);
  assertEquals(result.success, true);
});

Deno.test("validates type enum values", () => {
  const bugData: RequestData = {
    type: "bug_report",
    title: "Test",
    description: "Test description",
  };
  const featureData: RequestData = {
    type: "feature_request",
    title: "Test",
    description: "Test description",
  };

  assertEquals(requestSchema.safeParse(bugData).success, true);
  assertEquals(requestSchema.safeParse(featureData).success, true);
  assertEquals(
    requestSchema.safeParse({ ...bugData, type: "invalid" }).success,
    false
  );
});

Deno.test("title must be between 1 and 100 characters", () => {
  const baseData: RequestData = {
    type: "bug_report",
    title: "Test",
    description: "Test description",
  };

  assertEquals(requestSchema.safeParse(baseData).success, true);

  const emptyTitle = requestSchema.safeParse({ ...baseData, title: "" });
  assertEquals(emptyTitle.success, false);

  const longTitle = "A".repeat(101);
  const tooLongTitle = requestSchema.safeParse({
    ...baseData,
    title: longTitle,
  });
  assertEquals(tooLongTitle.success, false);

  const maxLengthTitle = "A".repeat(100);
  const validLongTitle = requestSchema.safeParse({
    ...baseData,
    title: maxLengthTitle,
  });
  assertEquals(validLongTitle.success, true);
});

Deno.test("description must be between 1 and 2000 characters", () => {
  const baseData: RequestData = {
    type: "bug_report",
    title: "Test",
    description: "Test description",
  };

  assertEquals(requestSchema.safeParse(baseData).success, true);

  const emptyDesc = requestSchema.safeParse({ ...baseData, description: "" });
  assertEquals(emptyDesc.success, false);

  const longDesc = "A".repeat(2001);
  const tooLongDesc = requestSchema.safeParse({
    ...baseData,
    description: longDesc,
  });
  assertEquals(tooLongDesc.success, false);

  const maxLengthDesc = "A".repeat(2000);
  const validLongDesc = requestSchema.safeParse({
    ...baseData,
    description: maxLengthDesc,
  });
  assertEquals(validLongDesc.success, true);
});

Deno.test("optional metadata fields are truly optional", () => {
  const requiredOnly: RequestData = {
    type: "bug_report",
    title: "Test",
    description: "Test",
  };

  assertEquals(requestSchema.safeParse(requiredOnly).success, true);

  const withPartialMetadata: RequestData = {
    ...requiredOnly,
    app_version: "1.0.0",
    device_model: "iPhone",
  };
  assertEquals(requestSchema.safeParse(withPartialMetadata).success, true);
});

Deno.test("rejects missing required fields", () => {
  assertEquals(requestSchema.safeParse({}).success, false);
  assertEquals(requestSchema.safeParse({ type: "bug_report" }).success, false);
  assertEquals(
    requestSchema.safeParse({ type: "bug_report", title: "Test" }).success,
    false
  );
});
