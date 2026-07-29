interface GateModule {
  analyzeTrackCalls(
    source: string
  ): { event: string | null; executable: boolean }[];
  loadManifest(mobileRoot: string): {
    canonicalJourney: {
      requiredStageCount: number;
      status: string;
    };
    operationalStages: unknown[];
    ownerGithubLogin: string;
  };
  runReleaseGate(input: {
    environment?: Record<string, string | undefined>;
    mobileRoot: string;
    releaseMode?: boolean;
  }): unknown;
  validateInstrumentation(
    mobileRoot: string,
    manifest: unknown
  ): {
    contractEventCount: number;
    operationalStageCount: number;
  };
  validateProductionConfig(config: {
    expectedHost?: string;
    expectedKeySha256?: string;
    host?: string;
    key?: string;
  }): unknown;
}

const crypto = jest.requireActual("crypto") as {
  createHash(algorithm: string): {
    digest(encoding: string): string;
    update(value: string): { digest(encoding: string): string };
  };
};
const fs = jest.requireActual("fs") as {
  readFileSync(file: string, encoding: string): string;
};
const gate = jest.requireActual(
  "../../scripts/analytics-release-gate.cjs"
) as GateModule;
const mobileRoot = process.cwd();
const manifest = gate.loadManifest(mobileRoot);
const productionKey = `phc_${"a".repeat(32)}`;
const productionKeyFingerprint = crypto
  .createHash("sha256")
  .update(productionKey)
  .digest("hex");

describe("analytics release data-quality gate", () => {
  it("uses the TypeScript AST to enforce current operational stages", () => {
    expect(gate.validateInstrumentation(mobileRoot, manifest)).toEqual({
      contractEventCount: expect.any(Number),
      operationalStageCount: 4,
    });
  });

  it("does not treat comments or statically dead calls as instrumentation", () => {
    const calls = gate.analyzeTrackCalls(`
      // trackEvent("workout_completed", { occurrence_id: "comment" });
      if (false) {
        trackEvent("workout_completed", { occurrence_id: "dead" });
      }
    `);

    expect(calls).toEqual([
      expect.objectContaining({
        event: "workout_completed",
        executable: false,
      }),
    ]);
  });

  it("fails release mode closed while canonical dependencies are Todo", () => {
    expect(() =>
      gate.runReleaseGate({
        environment: {
          EXPO_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
          EXPO_PUBLIC_POSTHOG_KEY: productionKey,
          POSTHOG_EXPECTED_HOST: "https://eu.i.posthog.com",
          POSTHOG_EXPECTED_KEY_SHA256: productionKeyFingerprint,
        },
        mobileRoot,
        releaseMode: true,
      })
    ).toThrow(/SWE-79 \(Todo\).*SWE-81 \(Todo\)/);
  });

  it("records the canonical eight-stage dependency explicitly", () => {
    expect(manifest.canonicalJourney).toMatchObject({
      requiredStageCount: 8,
      status: "blocked",
    });
    expect(manifest.operationalStages).toHaveLength(4);
    expect(manifest.ownerGithubLogin).toBeTruthy();
  });

  it("binds alert permissions, production environment, EAS config and build dependency", () => {
    const workflow = fs.readFileSync(
      `${mobileRoot}/../../.github/workflows/analytics-release-gate.yml`,
      "utf8"
    );

    expect(workflow).toContain("issues: write");
    expect(workflow.match(/environment: production/g)).toHaveLength(2);
    expect(workflow).toContain("env:exec --environment production");
    expect(workflow).toContain("needs: analytics-data-quality");
    expect(workflow).toContain("--profile production");

    const codeowners = fs.readFileSync(
      `${mobileRoot}/../../.github/CODEOWNERS`,
      "utf8"
    );
    expect(codeowners).toContain(`@${manifest.ownerGithubLogin}`);
  });

  it("accepts only the protected production PostHog project and host", () => {
    expect(
      gate.validateProductionConfig({
        expectedHost: "https://eu.i.posthog.com",
        expectedKeySha256: productionKeyFingerprint,
        host: "https://eu.i.posthog.com",
        key: productionKey,
      })
    ).toEqual({
      hostOrigin: "https://eu.i.posthog.com",
      keyConfigured: true,
      projectFingerprintMatched: true,
    });
  });

  it.each([
    [
      "placeholder key",
      {
        expectedHost: "https://eu.i.posthog.com",
        expectedKeySha256: productionKeyFingerprint,
        host: "https://eu.i.posthog.com",
        key: "ci-production-placeholder",
      },
    ],
    [
      "arbitrary HTTPS host",
      {
        expectedHost: "https://analytics.attacker.example",
        expectedKeySha256: productionKeyFingerprint,
        host: "https://analytics.attacker.example",
        key: productionKey,
      },
    ],
    [
      "wrong project fingerprint",
      {
        expectedHost: "https://eu.i.posthog.com",
        expectedKeySha256: "b".repeat(64),
        host: "https://eu.i.posthog.com",
        key: productionKey,
      },
    ],
    [
      "mismatched protected host",
      {
        expectedHost: "https://us.i.posthog.com",
        expectedKeySha256: productionKeyFingerprint,
        host: "https://eu.i.posthog.com",
        key: productionKey,
      },
    ],
  ])("rejects %s", (_label, config) => {
    expect(() => gate.validateProductionConfig(config)).toThrow();
  });
});
