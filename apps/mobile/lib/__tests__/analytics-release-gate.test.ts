import {
  analyticsEventSchemas,
  criticalFunnelEvents,
} from "../analytics-contract";
import { getAnalyticsConfigHealth } from "../analytics-config";

interface DirectoryEntry {
  isDirectory(): boolean;
  name: string;
}

const fs = jest.requireActual("fs") as {
  readFileSync(file: string, encoding: string): string;
  readdirSync(
    directory: string,
    options: { withFileTypes: true }
  ): DirectoryEntry[];
};
const path = jest.requireActual("path") as {
  join(...paths: string[]): string;
};

const sourceRoot = process.cwd();
const excludedDirectories = new Set(["__tests__", "node_modules"]);

function findSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return excludedDirectories.has(entry.name)
        ? []
        : findSourceFiles(entryPath);
    }

    return /\.[jt]sx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function trackedEvents(): string[] {
  const eventPattern = /trackEvent\s*\(\s*["']([^"']+)["']/g;

  return findSourceFiles(sourceRoot).flatMap((file) => {
    const source = fs.readFileSync(file, "utf8");
    return [...source.matchAll(eventPattern)].map((match) => match[1]);
  });
}

describe("analytics release data-quality gate", () => {
  const events = trackedEvents();

  it("requires every tracked event to exist in the contract", () => {
    const contractEvents = new Set(Object.keys(analyticsEventSchemas));
    const uncontractedEvents = [...new Set(events)].filter(
      (event) => !contractEvents.has(event)
    );

    expect(uncontractedEvents).toEqual([]);
  });

  it.each(criticalFunnelEvents)(
    "has exactly one instrumentation point for critical stage %s",
    (eventName) => {
      expect(events.filter((event) => event === eventName)).toHaveLength(1);
    }
  );

  const productionConfigTest =
    process.env.ANALYTICS_REQUIRE_PRODUCTION_CONFIG === "true" ? it : it.skip;

  productionConfigTest(
    "reports healthy production analytics configuration without exposing keys",
    () => {
      const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
      const health = getAnalyticsConfigHealth({
        key,
        host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
      });

      console.info("[analytics-release-gate] configuration health", health);
      expect(health.status).toBe("healthy");
      if (key) {
        expect(JSON.stringify(health)).not.toContain(key);
      }
    }
  );
});
