# {{APP_NAME}} - Guía de Usuario

## 🎯 ¡Bienvenido

Esta guía te ayudará a configurar y ejecutar la aplicación {{APP_NAME}} en tu computadora. ¡No se requieren conocimientos técnicos!

## 📋 Lo Que Necesitas

- **Windows 10/11**: Cualquier computadora Windows reciente
- **Linux (Ubuntu/Debian)**: Cualquier computadora Linux
- **macOS**: Cualquier Mac (Intel o Apple Silicon)
- **Conexión a internet**: Para la configuración inicial (solo una vez)

## 🚀 Guía de Inicio Rápido

### Paso 1: Extraer los Archivos

1. **Encuentra el archivo descargado**: Busca un archivo que termine en `.zip` (ej., `{{APP_NAME}}-windows-x64-2024-01-15.zip`)
2. **Haz clic derecho en el archivo** y selecciona "Extraer Todo" o "Extraer Aquí"
3. **Elige una ubicación** (como tu Escritorio o carpeta Documentos)
4. **Haz clic en "Extraer"**

### Paso 2: Ejecutar la Configuración

{{PLATFORM_SETUP_INSTRUCTIONS_ES}}

### Paso 3: Iniciar la Aplicación

{{PLATFORM_START_INSTRUCTIONS_ES}}

## 🌐 Usando la Aplicación

1. **Abre tu navegador web** (Chrome, Firefox, Safari, Edge)
2. **Ve a**: [http://localhost:{{CLIENT_PORT}}](http://localhost:{{CLIENT_PORT}})
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
- Intenta ejecutar: `chmod +x *.sh`

**"La aplicación no inicia"**

- Asegúrate de haber ejecutado el script de configuración primero
- Verifica que estés en la carpeta correcta
- Intenta reiniciar tu computadora

**"Conflictos de dependencias npm" o "errores ERESOLVE"**

- El script de configuración intenta automáticamente múltiples estrategias para resolver conflictos
- Si ves errores de dependencias, intenta ejecutar manualmente: `npm install --production --force --legacy-peer-deps`
- Esto es común con aplicaciones complejas y generalmente se resuelve automáticamente

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

## 🎉 ¡Estás Listo

Una vez que la aplicación esté ejecutándose, puedes:

- Acceder a ella en [http://localhost:{{CLIENT_PORT}}](http://localhost:{{CLIENT_PORT}})
- Usar todas las funciones de la aplicación {{APP_NAME}}
- Cerrar las ventanas de terminal/línea de comandos cuando hayas terminado

**Nota**: Mantén las ventanas de terminal/línea de comandos abiertas mientras uses la aplicación. Ciérralas cuando hayas terminado.

---

_Generado el: {{GENERATED_DATE_ES}}_
