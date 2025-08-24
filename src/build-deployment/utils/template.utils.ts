import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createRequire } from "module";

// Load templates from files
// Use createRequire to reliably find the package directory
function getTemplateDir(): string {
  try {
    // Create a require function that can resolve from the current module
    const require = createRequire(import.meta.url);
    
    // Resolve the package.json to find the package root
    const packageJsonPath = require.resolve("@finografic/project-scripts/package.json");
    const packageRoot = dirname(packageJsonPath);
    
    // Check for templates in the expected locations
    const possiblePaths = [
      join(packageRoot, "src", "build-deployment", "templates"),
      join(packageRoot, "bin", "build-deployment", "templates"),
      join(packageRoot, "dist", "build-deployment", "templates"),
      join(packageRoot, "templates"),
    ];
    
    for (const templatePath of possiblePaths) {
      if (existsSync(join(templatePath, "setup", "macos.template.sh"))) {
        return templatePath;
      }
    }
    
    // If we can't find templates in the package, fall back to relative paths
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const fallbackPaths = [
      join(currentDir, "..", "src", "build-deployment", "templates"),
      join(currentDir, "..", "bin", "build-deployment", "templates"),
      join(currentDir, "..", "templates"),
    ];
    
    for (const templatePath of fallbackPaths) {
      if (existsSync(join(templatePath, "setup", "macos.template.sh"))) {
        return templatePath;
      }
    }
    
    // Final fallback
    return possiblePaths[0];
  } catch (error) {
    // If require.resolve fails, fall back to relative paths
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const fallbackPaths = [
      join(currentDir, "..", "src", "build-deployment", "templates"),
      join(currentDir, "..", "bin", "build-deployment", "templates"),
      join(currentDir, "..", "templates"),
    ];
    
    for (const templatePath of fallbackPaths) {
      if (existsSync(join(templatePath, "setup", "macos.template.sh"))) {
        return templatePath;
      }
    }
    
    // Last resort fallback
    return fallbackPaths[0];
  }
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
