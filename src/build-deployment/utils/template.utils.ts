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
  const currentDir = dirname(fileURLToPath(import.meta.url));
  console.log(`[DEBUG] Template resolution starting from: ${currentDir}`);

  // For pnpm dlx execution, we need to find the actual package directory
  // The file path structure in pnpm dlx is complex, so we search upward
  let searchDir = currentDir;
  const maxLevels = 10; // Prevent infinite loops

  for (let i = 0; i < maxLevels; i++) {
    console.log(`[DEBUG] Level ${i}: Checking directory: ${searchDir}`);
    
    // Look for our package.json to identify the package root
    const packageJsonPath = join(searchDir, "package.json");
    if (existsSync(packageJsonPath)) {
      console.log(`[DEBUG] Found package.json at: ${packageJsonPath}`);
      try {
        const fs = require("fs");
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8")
        );
        console.log(`[DEBUG] Package name: ${packageJson.name}`);
        if (packageJson.name === "@finografic/project-scripts") {
          console.log(`[DEBUG] Found our package! Root: ${searchDir}`);
          // Found our package root! Now look for templates
          const srcTemplates = join(
            searchDir,
            "src",
            "build-deployment",
            "templates"
          );
          const binTemplates = join(
            searchDir,
            "bin",
            "build-deployment",
            "templates"
          );

          console.log(`[DEBUG] Checking srcTemplates: ${srcTemplates}`);
          console.log(`[DEBUG] Checking binTemplates: ${binTemplates}`);

          // Check which one has our test file
          if (existsSync(join(srcTemplates, "setup", "macos.template.sh"))) {
            console.log(`[DEBUG] Found templates in src: ${srcTemplates}`);
            return srcTemplates;
          }
          if (existsSync(join(binTemplates, "setup", "macos.template.sh"))) {
            console.log(`[DEBUG] Found templates in bin: ${binTemplates}`);
            return binTemplates;
          }
        }
      } catch {
        // Continue searching if package.json is malformed
      }
    }
    
    // Special check for pnpm directory structure
    // In pnpm dlx, the path might be: .../node_modules/@finografic/project-scripts/...
    // Let's check if we're in a scoped package directory structure
    if (searchDir.includes("@finografic") && !searchDir.includes("project-scripts")) {
      const projectScriptsDir = join(searchDir, "project-scripts");
      if (existsSync(projectScriptsDir)) {
        const srcTemplates = join(projectScriptsDir, "src", "build-deployment", "templates");
        const binTemplates = join(projectScriptsDir, "bin", "build-deployment", "templates");
        
        if (existsSync(join(srcTemplates, "setup", "macos.template.sh"))) {
          return srcTemplates;
        }
        if (existsSync(join(binTemplates, "setup", "macos.template.sh"))) {
          return binTemplates;
        }
      }
    }

    // Move up one directory
    const parentDir = dirname(searchDir);
    if (parentDir === searchDir) {
      // Reached filesystem root
      break;
    }
    searchDir = parentDir;
  }

  // Fallback to relative paths from current location
  const fallbackPaths = [
    join(currentDir, "..", "..", "src", "build-deployment", "templates"),
    join(currentDir, "..", "..", "bin", "build-deployment", "templates"),
    join(currentDir, "..", "templates"),
  ];

  for (const templatePath of fallbackPaths) {
    if (existsSync(join(templatePath, "setup", "macos.template.sh"))) {
      return templatePath;
    }
  }

  // Final fallback
  console.log(`[DEBUG] No templates found, using fallback: ${fallbackPaths[0]}`);
  return fallbackPaths[0];
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
