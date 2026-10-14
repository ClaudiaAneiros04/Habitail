import * as Crypto from 'expo-crypto';

/**
 * Genera un identificador universal único (UUID v4) seguro y conforme al estándar RFC 4122.
 * Utiliza la API nativa de `expo-crypto` en Expo SDK 54.
 */
export function generateUUID(): string {
  return Crypto.randomUUID();
}
