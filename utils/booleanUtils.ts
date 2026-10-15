/**
 * Utilidades para la conversión segura y consistente de valores booleanos
 * provenientes de almacenamiento SQLite o JSON.
 *
 * En entornos como SQLite Web (wa-sqlite / WASM) o ciertas serializaciones,
 * los valores de columnas enteras/booleanas pueden llegar como números (0, 1),
 * cadenas ("0", "1"), booleanos nativos (false, true), o null/undefined.
 *
 * El uso directo de `Boolean(val)` es propenso a errores porque en JavaScript:
 *   Boolean("0") === true   // ¡Incorrecto para valores lógicos falsos!
 *
 * Estas funciones normalizan de forma explícita y predecible dichos casos.
 */

/**
 * Convierte de manera explícita un valor numérico, string o booleano a un valor booleano TypeScript.
 *
 * Reglas de conversión:
 * - 1, "1", true, "true", "TRUE" -> true
 * - 0, "0", false, "false", "FALSE", "", null, undefined -> false
 * - Otros valores: si no coincide con los patrones de verdad conocidos, se evalúa contra defaultValue (por defecto false).
 *
 * @param value Valor procedente de SQLite o serializaciones.
 * @param defaultValue Valor por defecto cuando value es null o undefined (por defecto false).
 */
export function parseSqliteBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '1' || trimmed === 'true') {
      return true;
    }
    if (trimmed === '0' || trimmed === 'false' || trimmed === '') {
      return false;
    }
    return defaultValue;
  }

  return defaultValue;
}

/**
 * Variante nullable de parseSqliteBoolean.
 * Si el valor es null o undefined, devuelve null o undefined según corresponda (o el default especificado),
 * permitiendo preservar valores nulos cuando el campo del esquema es nullable.
 */
export function parseSqliteBooleanNullable(
  value: unknown,
  defaultIfNull: boolean | null = null
): boolean | null {
  if (value === null || value === undefined) {
    return defaultIfNull;
  }
  return parseSqliteBoolean(value, false);
}
