import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Template content embedded in code to avoid file system issues
const TEMPLATES = {
  "setup/windows.template.bat": `@echo off
setlocal ENABLEDELAYEDEXPANSION
echo ========================================
echo {{APP_NAME}} - Windows Setup
echo ========================================
echo.

REM 1) Ensure Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Attempting to install Node.js LTS via winget...
    winget --version >nul 2>&1
    if %errorlevel% EQU 0 (
        winget install OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
        if %errorlevel% NEQ 0 (
            echo ⚠️  winget install failed. Checking for Chocolatey...
            choco -v >nul 2>&1
            if %errorlevel% EQU 0 (
                choco install nodejs-lts -y
            ) else (
                echo ⚠️  Chocolatey not found. Opening Node.js download page...
                start https://nodejs.org/
                echo Please install Node.js LTS manually, then press any key to continue.
                pause >nul
            )
        )
    ) else (
        echo ⚠️  winget not available. Checking for Chocolatey...
        choco -v >nul 2>&1
        if %errorlevel% EQU 0 (
            choco install nodejs-lts -y
        ) else (
            echo ⚠️  Chocolatey not found. Opening Node.js download page...
            start https://nodejs.org/
            echo Please install Node.js LTS manually, then press any key to continue.
            pause >nul
        )
    )
)

REM Refresh PATH for current session (common install location)
set PATH=%PATH%;C:\\Program Files\\nodejs

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js still not detected. Please close this window, install Node.js, then run setup.bat again.
    pause
    exit /b 1
)

echo ✅ Node.js found:
node --version

echo ✅ npm found:
npm --version

echo.
echo 📦 Installing dependencies (production)...
npm install --production
if %errorlevel% NEQ 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo 🚀 Starting application (server + client)...
start "server" cmd /c start-server.bat
start "client" cmd /c start-client.bat

echo.
echo 🎉 Setup completed. Two windows should be running (server and client).
pause`,

  "setup/linux.template.sh": `#!/bin/bash
set -e

echo "========================================"
echo "{{APP_NAME}} - Linux Setup"
echo "========================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed. Attempting to install..."
  if command -v apt >/dev/null 2>&1; then
    sudo apt update && sudo apt install -y nodejs npm
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y nodejs npm
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --noconfirm nodejs npm
  else
    echo "⚠️  Could not auto-install Node.js. Please install Node 20+ from https://nodejs.org/ then re-run ./setup.sh"
    exit 1
  fi
fi

echo "✅ Node.js: $(node -v)"
echo "✅ npm: $(npm -v)"

echo "📦 Installing dependencies (production)..."
npm install --production

echo "🚀 Starting application (server + client)..."
chmod +x start-server.sh start-client.sh || true
(./start-server.sh &) >/dev/null 2>&1
(./start-client.sh &) >/dev/null 2>&1

echo "🎉 Setup completed. Server and client started in background."`,

  "setup/macos.template.sh": `#!/bin/bash
set -e

echo "========================================"
echo "{{APP_NAME}} - macOS Setup"
echo "========================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed. Attempting Homebrew install..."
  if command -v brew >/dev/null 2>&1; then
    brew install node
  else
    echo "⚠️  Homebrew not found. Installing Homebrew (may prompt for password)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
    brew install node
  fi
fi

echo "✅ Node.js: $(node -v)"
echo "✅ npm: $(npm -v)"

echo "📦 Installing dependencies (production)..."
npm install --production

echo "🚀 Starting application (server + client)..."
chmod +x start-server-macos.sh start-client-macos.sh || true
(./start-server-macos.sh &) >/dev/null 2>&1
(./start-client-macos.sh &) >/dev/null 2>&1

echo "🎉 Setup completed. Server and client started in background."`,

  "user-guide.en.template.md": `# {{APP_NAME}} - User Guide

## 🎯 Welcome!

This guide will help you set up and run the {{APP_NAME}} application on your computer. No technical knowledge required!

## 📋 What You Need

- **Windows 10/11**: Any recent Windows computer
- **Linux (Ubuntu/Debian)**: Any Linux computer
- **macOS**: Any Mac computer (Intel or Apple Silicon)
- **Internet connection**: For initial setup (one-time only)

## 🚀 Quick Start Guide

### Step 1: Extract the Files

1. **Find the downloaded file**: Look for a file ending in \`.zip\`
2. **Right-click the file** and select "Extract All" or "Extract Here"
3. **Choose a location** (like your Desktop or Documents folder)
4. **Click "Extract"**

### Step 2: Run the Setup

Follow the instructions for your operating system.

### Step 3: Start the Application

1. **Open your web browser** (Chrome, Firefox, Safari, Edge)
2. **Go to**: http://localhost:{{CLIENT_PORT}}
3. **The application should load** and be ready to use!

## 🔧 Troubleshooting

### Common Issues

**"Node.js is not installed"**
- Follow the installation instructions above
- Make sure to restart your computer after installing Node.js

**"Port is already in use"**
- Close any other applications that might be using ports {{CLIENT_PORT}} or {{SERVER_PORT}}
- Restart your computer and try again

**"Permission denied" (Linux/macOS)**
- Make sure you ran the setup script first
- Try running: \`chmod +x *.sh\`

**"Application won't start"**
- Make sure you ran the setup script first
- Check that you're in the correct folder
- Try restarting your computer

### Getting Help

If you're still having trouble:

1. **Check the README.md file** in this folder for technical details
2. **Look for error messages** in the terminal/command prompt
3. **Make sure your computer meets the requirements** listed above
4. **Try running the setup script again**

## 📞 Support

For technical support, please provide:
- Your operating system (Windows/Linux/macOS)
- Any error messages you see
- Steps you've already tried

## 🎉 You're Ready!

Once the application is running, you can:
- Access it at http://localhost:{{CLIENT_PORT}}
- Use all the features of the {{APP_NAME}} application
- Close the terminal/command prompt windows when you're done

**Note**: Keep the terminal/command prompt windows open while using the application. Close them when you're finished.

---

*Generated on: {{GENERATED_DATE}}*`,

  "user-guide.es.template.md": `# {{APP_NAME}} - Guía de Usuario

## 🎯 ¡Bienvenido!

Esta guía te ayudará a configurar y ejecutar la aplicación {{APP_NAME}} en tu computadora. ¡No se requieren conocimientos técnicos!

## 📋 Lo Que Necesitas

- **Windows 10/11**: Cualquier computadora Windows reciente
- **Linux (Ubuntu/Debian)**: Cualquier computadora Linux
- **macOS**: Cualquier Mac (Intel o Apple Silicon)
- **Conexión a internet**: Para la configuración inicial (solo una vez)

## 🚀 Guía de Inicio Rápido

### Paso 1: Extraer los Archivos

1. **Encuentra el archivo descargado**: Busca un archivo que termine en \`.zip\`
2. **Haz clic derecho en el archivo** y selecciona "Extraer Todo" o "Extraer Aquí"
3. **Elige una ubicación** (como tu Escritorio o carpeta Documentos)
4. **Haz clic en "Extraer"**

### Paso 2: Ejecutar la Configuración

Sigue las instrucciones para tu sistema operativo.

### Paso 3: Iniciar la Aplicación

1. **Abre tu navegador web** (Chrome, Firefox, Safari, Edge)
2. **Ve a**: http://localhost:{{CLIENT_PORT}}
3. **La aplicación debería cargar** y estar lista para usar!

## 🔧 Solución de Problemas

### Problemas Comunes

**"Node.js no está instalado"**
- Sigue las instrucciones de instalación arriba
- Asegúrate de reiniciar tu computadora después de instalar Node.js

**"Puerto ya está en uso"**
- Cierra cualquier otra aplicación que pueda estar usando los puertos {{CLIENT_PORT}} o {{SERVER_PORT}}
- Reinicia tu computadora e intenta nuevamente

**"Permiso denegado" (Linux/macOS)**
- Asegúrate de haber ejecutado el script de configuración primero
- Intenta ejecutar: \`chmod +x *.sh\`

**"La aplicación no inicia"**
- Asegúrate de haber ejecutado el script de configuración primero
- Verifica que estés en la carpeta correcta
- Intenta reiniciar tu computadora

### Obtener Ayuda

Si aún tienes problemas:

1. **Revisa el archivo README.md** en esta carpeta para detalles técnicos
2. **Busca mensajes de error** en la terminal/línea de comandos
3. **Asegúrate de que tu computadora cumpla con los requisitos** listados arriba
4. **Intenta ejecutar el script de configuración nuevamente**

## 📞 Soporte

Para soporte técnico, por favor proporciona:
- Tu sistema operativo (Windows/Linux/macOS)
- Cualquier mensaje de error que veas
- Pasos que ya has intentado

## 🎉 ¡Estás Listo!

Una vez que la aplicación esté ejecutándose, puedes:
- Acceder a ella en http://localhost:{{CLIENT_PORT}}
- Usar todas las funciones de la aplicación {{APP_NAME}}
- Cerrar las ventanas de terminal/línea de comandos cuando hayas terminado

**Nota**: Mantén las ventanas de terminal/línea de comandos abiertas mientras uses la aplicación. Ciérralas cuando hayas terminado.

---

*Generado el: {{GENERATED_DATE_ES}}*`,
};

/**
 * Process a template with variables
 */
export async function loadTemplate(
  templatePath: string,
  variables: Record<string, string | number | boolean>
): Promise<string> {
  const content = TEMPLATES[templatePath];
  if (!content) {
    throw new Error(`Template not found: ${templatePath}`);
  }

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
