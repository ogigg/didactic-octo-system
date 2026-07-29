const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const allowedPostHogOrigins = new Set([
  "https://app.posthog.com",
  "https://eu.i.posthog.com",
  "https://eu.posthog.com",
  "https://us.i.posthog.com",
]);

class AnalyticsGateError extends Error {
  constructor(classification, message) {
    super(message);
    this.classification = classification;
  }
}

function normalizedHttpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function validateProductionConfig(config) {
  const { key, host, expectedHost, expectedKeySha256 } = config;
  const origin = normalizedHttpsOrigin(host);
  const expectedOrigin = normalizedHttpsOrigin(expectedHost);

  if (!key || !/^phc_[A-Za-z0-9_-]{20,}$/.test(key)) {
    throw new AnalyticsGateError(
      "config",
      "EAS production EXPO_PUBLIC_POSTHOG_KEY is missing or malformed."
    );
  }
  if (!origin || !allowedPostHogOrigins.has(origin)) {
    throw new AnalyticsGateError(
      "config",
      "EAS production EXPO_PUBLIC_POSTHOG_HOST is not an allowed PostHog origin."
    );
  }
  if (!expectedOrigin || !allowedPostHogOrigins.has(expectedOrigin)) {
    throw new AnalyticsGateError(
      "config",
      "Protected production POSTHOG_EXPECTED_HOST is missing or invalid."
    );
  }
  if (origin !== expectedOrigin) {
    throw new AnalyticsGateError(
      "config",
      "EAS production PostHog host does not match the protected expected host."
    );
  }
  if (!expectedKeySha256 || !/^[a-f0-9]{64}$/.test(expectedKeySha256)) {
    throw new AnalyticsGateError(
      "config",
      "Protected production POSTHOG_EXPECTED_KEY_SHA256 is missing or malformed."
    );
  }

  const actualFingerprint = Buffer.from(sha256(key), "hex");
  const expectedFingerprint = Buffer.from(expectedKeySha256, "hex");
  if (
    actualFingerprint.length !== expectedFingerprint.length ||
    !crypto.timingSafeEqual(actualFingerprint, expectedFingerprint)
  ) {
    throw new AnalyticsGateError(
      "config",
      "EAS production PostHog project key does not match the protected project fingerprint."
    );
  }

  return {
    hostOrigin: origin,
    keyConfigured: true,
    projectFingerprintMatched: true,
  };
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ["__tests__", "node_modules", "scripts"].includes(entry.name)
        ? []
        : sourceFiles(entryPath);
    }
    return /\.[jt]sx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isSatisfiesExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function contractEventNames(contractFile) {
  const source = fs.readFileSync(contractFile, "utf8");
  const sourceFile = ts.createSourceFile(
    contractFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let events = null;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "analyticsEventSchemas" &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (ts.isObjectLiteralExpression(initializer)) {
        events = initializer.properties
          .map((property) => property.name)
          .filter(Boolean)
          .map((name) =>
            ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null
          )
          .filter(Boolean);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (!events) {
    throw new AnalyticsGateError(
      "schema",
      "Unable to read analyticsEventSchemas with the TypeScript AST."
    );
  }
  return new Set(events);
}

function propertyName(node) {
  if (
    (ts.isPropertyAssignment(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isPropertyDeclaration(node)) &&
    node.name &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
  ) {
    return node.name.text;
  }
  return null;
}

function objectHasOccurrenceId(node) {
  if (!node || !ts.isObjectLiteralExpression(node)) return false;
  return node.properties.some(
    (property) =>
      property.name &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === "occurrence_id"
  );
}

function isStaticallyDead(node) {
  let child = node;
  let parent = node.parent;
  while (parent) {
    if (ts.isIfStatement(parent)) {
      if (
        parent.expression.kind === ts.SyntaxKind.FalseKeyword &&
        parent.thenStatement === child
      ) {
        return true;
      }
      if (
        parent.expression.kind === ts.SyntaxKind.TrueKeyword &&
        parent.elseStatement === child
      ) {
        return true;
      }
    }
    if (
      ts.isWhileStatement(parent) &&
      parent.expression.kind === ts.SyntaxKind.FalseKeyword
    ) {
      return true;
    }
    child = parent;
    parent = parent.parent;
  }
  return false;
}

function analyzeTrackCalls(source, file = "fixture.ts") {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const calls = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "trackEvent"
    ) {
      const eventArgument = node.arguments[0];
      const payloadArgument = node.arguments[1];
      const event =
        eventArgument &&
        (ts.isStringLiteral(eventArgument) ||
          ts.isNoSubstitutionTemplateLiteral(eventArgument))
          ? eventArgument.text
          : null;
      const ancestors = [];
      let parent = node.parent;
      while (parent) {
        const name = propertyName(parent);
        if (name) ancestors.push(name);
        parent = parent.parent;
      }
      calls.push({
        ancestors,
        event,
        executable: !isStaticallyDead(node),
        file,
        hasOccurrenceId: objectHasOccurrenceId(payloadArgument),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return calls;
}

function trackCalls(mobileRoot) {
  return sourceFiles(mobileRoot).flatMap((file) => {
    const source = fs.readFileSync(file, "utf8");
    return analyzeTrackCalls(source, path.relative(mobileRoot, file));
  });
}

function validateInstrumentation(mobileRoot, manifest) {
  const contractEvents = contractEventNames(
    path.join(mobileRoot, "lib", "analytics-contract.ts")
  );
  const calls = trackCalls(mobileRoot);
  const dynamicCalls = calls.filter((call) => call.event === null);
  if (dynamicCalls.length > 0) {
    throw new AnalyticsGateError(
      "schema",
      "trackEvent names must be string literals so contract enforcement cannot be bypassed."
    );
  }

  const uncontracted = [...new Set(calls.map((call) => call.event))].filter(
    (event) => !contractEvents.has(event)
  );
  if (uncontracted.length > 0) {
    throw new AnalyticsGateError(
      "schema",
      `Tracked events missing from the Zod contract: ${uncontracted.join(", ")}.`
    );
  }

  for (const stage of manifest.operationalStages) {
    const matches = calls.filter(
      (call) => call.event === stage.event && call.executable
    );
    if (matches.length !== 1) {
      throw new AnalyticsGateError(
        "stage",
        `${stage.event} must have exactly one executable instrumentation call; found ${matches.length}.`
      );
    }
    const [match] = matches;
    if (
      match.file !== stage.file ||
      !match.ancestors.includes(stage.requiredAncestorProperty)
    ) {
      throw new AnalyticsGateError(
        "stage",
        `${stage.event} must run from ${stage.file} inside ${stage.requiredAncestorProperty}.`
      );
    }
    if (!match.hasOccurrenceId) {
      throw new AnalyticsGateError(
        "stage",
        `${stage.event} must provide its event-specific occurrence_id.`
      );
    }
  }

  return {
    contractEventCount: contractEvents.size,
    operationalStageCount: manifest.operationalStages.length,
  };
}

function validateCanonicalDependency(manifest) {
  const journey = manifest.canonicalJourney;
  if (
    journey.status !== "ready" ||
    manifest.operationalStages.length !== journey.requiredStageCount
  ) {
    const blockers = journey.blockingTickets
      .map((ticket) => `${ticket.id} (${ticket.status}): ${ticket.reason}`)
      .join(" ");
    throw new AnalyticsGateError(
      "dependency",
      `Canonical ${journey.requiredStageCount}-stage release contract is not ready. ${blockers}`
    );
  }
}

function loadManifest(mobileRoot) {
  return JSON.parse(
    fs.readFileSync(
      path.join(mobileRoot, "analytics-journey-manifest.json"),
      "utf8"
    )
  );
}

function writeReport(reportPath, report) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function runReleaseGate({
  environment = process.env,
  mobileRoot = process.cwd(),
  releaseMode = false,
  reportPath,
} = {}) {
  const manifest = loadManifest(mobileRoot);
  const checks = {};
  try {
    checks.instrumentation = validateInstrumentation(mobileRoot, manifest);
    if (releaseMode) {
      checks.configuration = validateProductionConfig({
        expectedHost: environment.POSTHOG_EXPECTED_HOST,
        expectedKeySha256: environment.POSTHOG_EXPECTED_KEY_SHA256,
        host: environment.EXPO_PUBLIC_POSTHOG_HOST,
        key: environment.EXPO_PUBLIC_POSTHOG_KEY,
      });
      validateCanonicalDependency(manifest);
    }
    const report = { checks, classification: null, status: "passed" };
    if (reportPath) writeReport(reportPath, report);
    return report;
  } catch (error) {
    const classification =
      error instanceof AnalyticsGateError ? error.classification : "unknown";
    const report = {
      checks,
      classification,
      message: error instanceof Error ? error.message : "Unknown gate failure",
      status: "failed",
    };
    if (reportPath) writeReport(reportPath, report);
    throw Object.assign(error, { report });
  }
}

if (require.main === module) {
  const releaseMode = process.env.ANALYTICS_RELEASE_MODE === "true";
  const reportPath =
    process.env.ANALYTICS_GATE_REPORT_PATH ||
    (releaseMode
      ? path.join(process.cwd(), "analytics-gate-report.json")
      : null);
  try {
    const report = runReleaseGate({
      releaseMode,
      reportPath,
    });
    console.info("[analytics-release-gate]", report);
  } catch (error) {
    console.error("[analytics-release-gate]", error.report);
    process.exitCode = 1;
  }
}

module.exports = {
  AnalyticsGateError,
  allowedPostHogOrigins,
  analyzeTrackCalls,
  loadManifest,
  runReleaseGate,
  trackCalls,
  validateCanonicalDependency,
  validateInstrumentation,
  validateProductionConfig,
};
