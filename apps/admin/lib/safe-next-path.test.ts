import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  const localDestinations = [
    "/",
    "/exercises",
    "/exercises/3f0c2b1e-8a57-4f5b-9d0e-6a8b7c9d1e2f",
    "/exercises?q=bench%20press&page=2",
    "/generations?window=7d&outcome=failed",
    "/generations/llm?request=abc#timeline",
    "/generations?return=%2F%2Fevil.test",
  ];

  for (const path of localDestinations) {
    test(`keeps local destination ${path}`, () => {
      assert.equal(safeNextPath(path), path);
    });
  }

  test("normalises dot segments that stay local", () => {
    assert.equal(safeNextPath("/exercises/../generations"), "/generations");
  });

  const hostileValues = [
    // Absolute and protocol-relative URLs.
    "https://evil.test",
    "http://evil.test/exercises",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//evil.test",
    "//evil.test/exercises",
    "///evil.test",
    // Backslashes, which browsers read as forward slashes.
    "/\\evil.test",
    "\\\\evil.test",
    "/\\/evil.test",
    "/exercises\\..\\..\\evil.test",
    // Whitespace and control characters that URL parsers strip.
    "/\t/evil.test",
    "/\n/evil.test",
    "/\r/evil.test",
    " //evil.test",
    "/\u0000/evil.test",
    // Encoded separators and double encoding.
    "/%2F%2Fevil.test",
    "/%2f/evil.test",
    "/%5C%5Cevil.test",
    "/%5c/evil.test",
    "/%252F%252Fevil.test",
    // Dot segments that collapse into a protocol-relative path.
    "/.//evil.test",
    "/..//evil.test",
    "/exercises/..//evil.test",
    // Credentials or a host smuggled in front of the path.
    "@evil.test",
    "evil.test/exercises",
    // Relative paths and the login page itself.
    "exercises",
    "./exercises",
    "?next=//evil.test",
    "/login",
    "/login?next=/exercises",
  ];

  for (const value of hostileValues) {
    test(`rejects ${JSON.stringify(value)}`, () => {
      assert.equal(safeNextPath(value), "/");
    });
  }

  test("falls back to / for missing or non-string values", () => {
    assert.equal(safeNextPath(undefined), "/");
    assert.equal(safeNextPath(null), "/");
    assert.equal(safeNextPath(""), "/");
    assert.equal(safeNextPath(["/exercises", "//evil.test"]), "/");
    assert.equal(safeNextPath(new File(["x"], "next")), "/");
  });

  test("never returns something that resolves off-origin", () => {
    for (const value of [...localDestinations, ...hostileValues]) {
      const resolved = new URL(safeNextPath(value), "https://admin.example");
      assert.equal(resolved.origin, "https://admin.example", value);
    }
  });
});
