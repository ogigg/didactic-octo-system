// Guards for the iOS signing invariants in apps/mobile/README.md -> "iOS
// signing": one shared certificate that only `ios certs_create` may create,
// and no credentials in the Matchfile, whose values fastlane prints unmasked.

// The app's tsconfig has no Node types (CI doesn't have the generated
// expo-env.d.ts), so type the few Node built-ins this file reads by hand.
declare const __dirname: string;
interface NodeFs {
  readFileSync(path: string, encoding: "utf8"): string;
}
interface NodePath {
  join(...parts: string[]): string;
}
const fs = jest.requireActual<NodeFs>("fs");
const path = jest.requireActual<NodePath>("path");

/** A fastlane Ruby file without its full-line comments. */
function readCode(file: string): string {
  return fs
    .readFileSync(path.join(__dirname, "..", file), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

describe("iOS signing guards", () => {
  it("keeps credentials out of the Matchfile", () => {
    const matchfile = readCode("Matchfile");

    for (const pattern of [
      /api_key/i,
      /\bkey\s*[:(]/i,
      /password/i,
      /File\.(bin)?read/,
      /ENV\[/,
      /\.p8\b/,
      /PRIVATE KEY/,
    ]) {
      expect(matchfile).not.toMatch(pattern);
    }
  });

  it("keeps match read-only by default", () => {
    expect(readCode("Matchfile")).toMatch(/^readonly\(true\)$/m);
  });

  it("creates signing assets only in the certs_create lane", () => {
    const fastfile = readCode("Fastfile");
    const laneStart = fastfile.indexOf("lane :certs_create do");
    const certsCreate = fastfile.slice(
      laneStart,
      fastfile.indexOf("\n  end\n", laneStart)
    );

    expect(fastfile.match(/readonly:\s*false/g)).toHaveLength(1);
    expect(certsCreate).toMatch(/readonly:\s*false/);
    expect(fastfile).not.toMatch(/allowProvisioningUpdates/);
    expect(fastfile).not.toMatch(/\bnuke\b/);
    expect(fastfile).not.toMatch(
      /\bget_certificates\b|\bcert\(|\bsigh\(|get_provisioning_profile/
    );
  });
});
