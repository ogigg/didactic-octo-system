// Loaded with `node --import` before the colocated `*.test.ts` files. Node
// strips the TypeScript itself, so this hook only teaches it the resolution
// Next.js gets from the bundler: the `@/` alias, extensionless relative
// imports and `next/*` subpaths that need a `.js` suffix under plain ESM.
import { registerHooks } from "node:module";

const adminRoot = new URL("../", import.meta.url);
const fallbackSuffixes = [".ts", ".tsx", ".js", "/index.ts"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), adminRoot).href
      : specifier;

    try {
      return nextResolve(target, context);
    } catch (error) {
      if ((error as { code?: string }).code !== "ERR_MODULE_NOT_FOUND") {
        throw error;
      }
      for (const suffix of fallbackSuffixes) {
        try {
          return nextResolve(target + suffix, context);
        } catch {
          // Try the next suffix.
        }
      }
      throw error;
    }
  },
});
