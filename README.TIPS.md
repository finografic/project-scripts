Creating a reusable @finografic/project-scripts package will help you standardize and share scripts across all your monorepos, making maintenance and updates much easier.

Here’s a high-level plan for creating your new project-scripts package:

### 1. Decide on the Package Structure

A typical structure might look like:

```
project-scripts/
├── bin/
│   └── clean-all.js (or .ts)
├── src/
│   └── clean-all.ts
├── package.json
├── tsconfig.json (if using TypeScript)
├── README.md
```

- `src/` contains the TypeScript source files.
- `bin/` contains the compiled JavaScript files or symlinks for CLI usage.
- `package.json` will define the entry points and bin scripts.

### 2. Move and Refactor Your Scripts

- Move your existing scripts (like `clean-all.ts`) into the `src/` directory of your new package.
- Refactor them if needed to be more generic/reusable across projects.
- Make sure to export functions for programmatic use and provide a CLI entry point.

### 3. Set Up CLI Entrypoints

In your `package.json`, add a `bin` field to expose scripts as CLI commands:

```json
"bin": {
  "finografic-clean-all": "./bin/clean-all.js"
}
```

- This allows users to run `npx finografic-clean-all` or add it to their npm scripts.

### 4. Publish to npm

- Make sure your package name is scoped: `@finografic/project-scripts`.
- Publish to npm (or GitHub Packages) so you can install it in your other monorepos.

### 5. Install and Use in Monorepos

- In your monorepos, install the package:
  `pnpm add -D @finografic/project-scripts`
- Use the scripts via CLI or import them programmatically.

---

#### Example: Adapting `clean-all.ts` for the Package

- Move `clean-all.ts` to `src/clean-all.ts`.
- Add a small wrapper in `bin/clean-all.js` (or use tsx for direct TypeScript execution).
- Update paths so they work relative to the consuming project, not the package itself.

---

Great questions! Here’s how your requirements influence the structure and usage of your scripts package and your monorepos:

---

## 1. **Scripts Package Structure**

Since some scripts require project-specific config files, and you may want to keep some scripts (like bash scripts) local to a project, you should:

- **Keep the scripts package focused on reusable, generic scripts** that can be shared across projects.
- **Allow scripts in the package to look for config files in the consuming project’s root** (not inside the package).
- **Continue to use a local `scripts/` folder in each monorepo** for:
  - Project-specific scripts/configs.
  - Bash scripts or scripts that are not generic enough to be shared.

### Example Structure

**In your scripts package (`@finografic/project-scripts`):**

```
project-scripts/
├── src/
│   └── clean-all.ts
│   └── some-other-script.ts
├── bin/
│   └── clean-all.js
├── package.json
├── README.md
```

**In your monorepo:**

```
my-monorepo/
├── scripts/
│   └── local-only-script.sh
│   └── my-script.config.js   # config for a shared script
├── node_modules/
│   └── @finografic/project-scripts/
├── package.json
```

---

## 2. **How Scripts Find Config Files**

- Scripts in your package should **look for config files relative to the current working directory** (i.e., the project root), not relative to the package.
- This way, you can keep configs in `scripts/` or the root of your monorepo, and the shared script will find them.

**Example in a script:**

```ts
// In @finografic/project-scripts/src/some-script.ts
import path from 'path';
import fs from 'fs';

const configPath = path.resolve(process.cwd(), 'scripts/my-script.config.js');
if (fs.existsSync(configPath)) {
  // Load and use config
}
```

---

## 3. **Where to Install the Package**

- **Install as a devDependency in the root of your monorepo** (not inside `scripts/`).
- This is the standard way for CLI tools and scripts packages.
- You can then run scripts via `npx`, or add them to your `package.json` scripts.

**Example:**

```json
"devDependencies": {
  "@finografic/project-scripts": "workspace:*"
},
"scripts": {
  "clean": "finografic-clean-all",
  "custom": "finografic-some-other-script"
}
```

---

## 4. **When to Use the Local `scripts/` Folder**

- For scripts/configs that are **project-specific** or not generic enough to share.
- For **config files** that are read by your shared scripts.
- For **bash scripts** or other tools that don’t fit the shared package model.

---

## 5. **Summary Table**

| Location         | Purpose                                      |
|------------------|----------------------------------------------|
| `@finografic/project-scripts` | Shared, reusable scripts (JS/TS)         |
| `my-monorepo/scripts/`        | Project-specific scripts/configs/bash    |
| `my-monorepo/package.json`    | Install shared scripts as devDependency  |

---

### TL;DR

- **Shared logic** → in your package.
- **Project-specific logic/configs** → in the monorepo’s `scripts/` folder.
- **Install the package at the monorepo root**.

---

If you want, I can show you a concrete example of a script in your package that loads a config from the consuming project’s `scripts/` folder. Just let me know!
