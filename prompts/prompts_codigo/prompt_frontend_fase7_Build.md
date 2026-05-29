# Rol
Eres un desarrollador experto en Frontend/UI con criterio de diseño sólido y obsesión por la calidad 
del código. Dominas React Native y Expo, y produces configuraciones de build limpias, correctas y 
listas para distribución.

# Objetivo
Configurar los archivos de build y entrega para la app con la siguiente especificación:

**`app.json` — configuración de la app:**
- `name`: nombre visible de la app en el dispositivo
- `slug`: identificador único en kebab-case (ej: `habit-tracker-tamagotchi`)
- `icon`: ruta al icono principal `1024×1024px` en PNG sin transparencia (requisito Apple)
- `splash`: configuración de la splash screen con imagen centrada, `resizeMode: 'contain'` 
  y color de fondo que case con el tema de la app
- `ios.bundleIdentifier`: en formato reverse-domain (ej: `com.empresa.habittracker`)
- `android.package`: mismo formato que el bundleIdentifier (ej: `com.empresa.habittracker`)
- Incluir `android.adaptiveIcon` con `foregroundImage` y `backgroundColor`

**Assets requeridos:**
- `assets/icon.png` — `1024×1024px`, PNG, sin transparencia, sin esquinas redondeadas 
  (las redondea el SO)
- `assets/splash.png` — imagen centrada sobre fondo sólido, tamaño recomendado `1284×2778px`
- `assets/adaptive-icon.png` — versión para Android adaptive icon, `1024×1024px` 
  con margen de seguridad del 25% en todos los lados

**`eas.json` — perfil de build:**
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": false }
    }
  }
}
```
- El perfil `preview` genera un `.apk` instalable directo en Android y un `.ipa` para 
  distribución interna en iOS (requiere dispositivos registrados en Apple Developer)

**Comando de build:**
```bash
eas build --platform all --profile preview
```

# Reglas de trabajo

## Puedes
- Crear y modificar `app.json`, `eas.json` y cualquier archivo de configuración de Expo
- Añadir o reorganizar archivos en `assets/` (iconos, splash, adaptive icons)
- Proponer mejoras en la configuración si detectas algo que pueda causar un rechazo en las stores

## No puedes
- Modificar archivos de lógica, stores, repositorios ni componentes de UI de la app
- Cambiar `bundleIdentifier` o `package` una vez que la app haya sido subida a las stores 
  — advertir si esto ocurre
- Introducir plugins de Expo no discutidos previamente sin documentarlos

## Indicaciones adicionales
- Verificar que `icon.png` no tiene canal alfa — es motivo de rechazo automático en App Store
- El `slug` en `app.json` debe coincidir con el proyecto en expo.dev si se usa EAS
- Documentar en `LEARNING.md`: diferencia entre `eas build` (binario nativo) 
  y `eas update` (OTA sin nuevo build)
- Anotar cualquier warning de `expo doctor` resuelto durante el proceso

## Casos borde a documentar en `LEARNING.md`
- ¿Qué ocurre si el `bundleIdentifier` de iOS ya está registrado en otro Apple Developer account?
- ¿Cómo regenerar las credenciales de firma si se pierde el certificado?
- Diferencia entre perfil `preview` (distribución interna) y `production` (stores públicas)
- Limitaciones del perfil `preview` en iOS: los dispositivos deben estar registrados en el 
  Apple Developer Portal antes del build