import { parseSqliteBoolean, parseSqliteBooleanNullable } from '../booleanUtils';

describe('booleanUtils - parseSqliteBoolean', () => {
  describe('Valores estrictos 0, 1, "0", "1", true, false', () => {
    it('debe convertir números 1 -> true y 0 -> false', () => {
      expect(parseSqliteBoolean(1)).toBe(true);
      expect(parseSqliteBoolean(0)).toBe(false);
    });

    it('debe convertir cadenas "1" -> true y "0" -> false (evitando el gotcha Boolean("0") === true)', () => {
      // El gotcha nativo de JS:
      expect(Boolean('0')).toBe(true);
      // Nuestra función segura:
      expect(parseSqliteBoolean('0')).toBe(false);
      expect(parseSqliteBoolean('1')).toBe(true);
      expect(parseSqliteBoolean(' 0 ')).toBe(false);
      expect(parseSqliteBoolean(' 1 ')).toBe(true);
    });

    it('debe mantener booleanos nativos true y false', () => {
      expect(parseSqliteBoolean(true)).toBe(true);
      expect(parseSqliteBoolean(false)).toBe(false);
    });

    it('debe convertir cadenas literales "true" y "false" (insensible a mayúsculas)', () => {
      expect(parseSqliteBoolean('true')).toBe(true);
      expect(parseSqliteBoolean('TRUE')).toBe(true);
      expect(parseSqliteBoolean('false')).toBe(false);
      expect(parseSqliteBoolean('FALSE')).toBe(false);
    });
  });

  describe('Tratamiento de null, undefined y valores por defecto', () => {
    it('debe retornar defaultValue cuando el valor es null o undefined (por defecto false)', () => {
      expect(parseSqliteBoolean(null)).toBe(false);
      expect(parseSqliteBoolean(undefined)).toBe(false);
      expect(parseSqliteBoolean(null, true)).toBe(true);
      expect(parseSqliteBoolean(undefined, true)).toBe(true);
    });

    it('debe manejar parseSqliteBooleanNullable preservando null/undefined si corresponde', () => {
      expect(parseSqliteBooleanNullable(null)).toBeNull();
      expect(parseSqliteBooleanNullable(undefined)).toBeNull();
      expect(parseSqliteBooleanNullable(1)).toBe(true);
      expect(parseSqliteBooleanNullable('1')).toBe(true);
      expect(parseSqliteBooleanNullable(0)).toBe(false);
      expect(parseSqliteBooleanNullable('0')).toBe(false);
    });
  });

  describe('Valores atípicos o no contemplados', () => {
    it('cadena vacía retorna false', () => {
      expect(parseSqliteBoolean('')).toBe(false);
      expect(parseSqliteBoolean('   ')).toBe(false);
    });

    it('números distintos de 1 retornan false', () => {
      expect(parseSqliteBoolean(2)).toBe(false);
      expect(parseSqliteBoolean(-1)).toBe(false);
    });

    it('objetos o tipos no booleanos retornan defaultValue', () => {
      expect(parseSqliteBoolean({})).toBe(false);
      expect(parseSqliteBoolean({}, true)).toBe(true);
    });
  });
});
