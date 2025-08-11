import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

/**
 * Helper function to load a module in both CommonJS and ESM environments
 * @param filePath Absolute path to the module file
 * @returns Promise that resolves to the module exports
 */
export async function loadModule<T>(filePath: string): Promise<T> {
  try {
    // Try require first (for CommonJS)
    const require = createRequire(import.meta.url);
    const required = require(filePath);
    return Promise.resolve(required.default || required);
  } catch (err) {
    if ((err as Error).message.includes("require is not defined")) {
      // If require fails because we're in ESM, try import
      const fileUrl = pathToFileURL(filePath).href;
      return import(fileUrl).then((m) => m.default || m);
    }
    throw err;
  }
}
