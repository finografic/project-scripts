import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createRequire } from "module";

// Load templates from files
// When running via pnpm dlx, we need to resolve the template directory
// relative to the package installation, not the compiled JS file
function getTemplateDir(): string {
  // First, try to find templates relative to the current JS file location
  // This works when the templates are properly installed alongside the JS
  const currentDir = dirname(fileURLToPath(import.meta.url));
  
  // When running via pnpm dlx, the file structure should be:
  // node_modules/@finografic/project-scripts/bin/build-deployment.js
  // node_modules/@finografic/project-scripts/src/build-deployment/templates/
  
  const candidatePaths = [
    // Try src templates (included in package files)
    join(currentDir, "..", "..", "src", "build-deployment", "templates"),
    // Try bin templates (development/local)  
    join(currentDir, "..", "..", "bin", "build-deployment", "templates"),
    // Direct relative (fallback)
    join(currentDir, "..", "templates"),
  ];
  
  // Use require.resolve as backup to find package root
  try {
    const require = createRequire(import.meta.url);
    const packagePath = require.resolve("@finografic/project-scripts/package.json");
    const packageDir = dirname(packagePath);
    candidatePaths.unshift(join(packageDir, "src", "build-deployment", "templates"));
  } catch {
    // Ignore if can't resolve package
  }
  
  // Try each candidate path and return the first one that exists
  for (const templatePath of candidatePaths) {
    try {
      // Try to read a known template file to verify the path exists
      const testFile = join(templatePath, "setup", "macos.template.sh");
      if (existsSync(testFile)) {
        return templatePath;
      }
    } catch {
      // Continue to next candidate
    }
  }
  
  // If nothing works, return the first candidate (will fail gracefully)
  return candidatePaths[0] || join(currentDir, "..", "templates");
}

const TEMPLATE_DIR = getTemplateDir();

async function loadTemplateFile(templatePath: string): Promise<string> {
  const fullPath = join(TEMPLATE_DIR, templatePath);
  return readFile(fullPath, "utf-8");
}

/**
 * Process a template with variables
 */
export async function loadTemplate(
  templatePath: string,
  variables: Record<string, string | number | boolean>
): Promise<string> {
  const content = await loadTemplateFile(templatePath);
  return content.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const value = variables[key.trim()];
    return value !== undefined ? String(value) : "";
  });
}

/**
 * Load platform-specific setup script template
 */
export async function loadSetupTemplate(
  platform: "windows" | "linux" | "macos",
  variables: Record<string, string | number | boolean>
): Promise<string> {
  const templateFile = {
    windows: "setup/windows.template.bat",
    linux: "setup/linux.template.sh",
    macos: "setup/macos.template.sh",
  }[platform];

  return loadTemplate(templateFile, variables);
}

/**
 * Load user guide template in specified language
 */
export async function loadUserGuideTemplate(
  language: "en" | "es",
  variables: Record<string, string | number | boolean>
): Promise<string> {
  const templateFile = `user-guide.${language}.template.md`;
  return loadTemplate(templateFile, variables);
}

/**
 * Format a date for the specified locale
 */
export function formatDate(locale: string): string {
  return new Date().toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
