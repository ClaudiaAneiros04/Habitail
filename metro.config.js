const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Permite a Metro resolver librerías modernas de ESM (como date-fns v4) 
// que utilizan `exports` en su package.json apuntando a archivos .js
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
