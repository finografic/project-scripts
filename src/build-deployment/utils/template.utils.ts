import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, "..", "templates");

/**
 * Load and process a template file with variables
 */
export async function loadTemplate(
  templatePath: string,
  variables: Record<string, string | number | boolean>
): Promise<string> {
  const fullPath = join(TEMPLATES_DIR, templatePath);
  const content = await readFile(fullPath, "utf-8");

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
