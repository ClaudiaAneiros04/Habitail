import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { PetSprite, getRowForMood, isGhostMood } from '../PetSprite';
import { PetState } from '../../../types';

describe('PetSprite Logic & Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Mapeo de filas (getRowForMood)', () => {
    it('mapea correctamente cada estado de ánimo a su fila correspondiente', () => {
      // Fila 0: 'happy'
      expect(getRowForMood('happy')).toBe(0);
      expect(getRowForMood('HAPPY')).toBe(0);
      expect(getRowForMood(PetState.HAPPY)).toBe(0);

      // Fila 1: 'cheering'
      expect(getRowForMood('cheering')).toBe(1);
      expect(getRowForMood('CHEERING')).toBe(1);
      expect(getRowForMood(PetState.CHEERING)).toBe(1);

      // Fila 2: 'confused'
      expect(getRowForMood('confused')).toBe(2);
      expect(getRowForMood('CONFUSED')).toBe(2);
      expect(getRowForMood(PetState.CONFUSED)).toBe(2);

      // Fila 3: 'sad'
      expect(getRowForMood('sad')).toBe(3);
      expect(getRowForMood('SAD')).toBe(3);
      expect(getRowForMood(PetState.SAD)).toBe(3);

      // Fila 4: 'absent' y 'ghost'
      expect(getRowForMood('absent')).toBe(4);
      expect(getRowForMood('ABSENT')).toBe(4);
      expect(getRowForMood('ghost')).toBe(4);
      expect(getRowForMood('GHOST')).toBe(4);
      expect(getRowForMood(PetState.ABSENT)).toBe(4);
    });

    it('devuelve fila 0 por defecto ante un mood desconocido', () => {
      expect(getRowForMood('unknown' as any)).toBe(0);
    });
  });

  describe('Detección de estado fantasma (isGhostMood)', () => {
    it('identifica correctamente "ghost" y "absent"', () => {
      expect(isGhostMood('ghost')).toBe(true);
      expect(isGhostMood('GHOST')).toBe(true);
      expect(isGhostMood('absent')).toBe(true);
      expect(isGhostMood(PetState.ABSENT)).toBe(true);

      expect(isGhostMood('happy')).toBe(false);
      expect(isGhostMood('cheering')).toBe(false);
      expect(isGhostMood('confused')).toBe(false);
      expect(isGhostMood('sad')).toBe(false);
    });
  });

  describe('Renderizado y recorte visual (View & Image sizing)', () => {
    it('aplica el tamaño correcto al contenedor (size x size) y a la imagen (size*4 x size*5)', () => {
      const size = 150;
      let testRenderer: any;
      act(() => {
        testRenderer = renderer.create(<PetSprite mood="happy" size={size} />);
      });

      const root = testRenderer!.root;
      const container = root.findByProps({ testID: 'pet-sprite' });
      const image = root.findByProps({ testID: 'pet-sprite-image' });

      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ width: size, height: size }),
        ])
      );

      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            width: size * 4,
            height: size * 5,
          }),
        ])
      );
    });
  });

  describe('Control de animación y frames', () => {
    it('avanza los frames de 0 a 3 y vuelve a 0 en bucle continuo para mood no fantasma', () => {
      const size = 100;
      let testRenderer: any;
      act(() => {
        testRenderer = renderer.create(
          <PetSprite mood="cheering" size={size} frameDurationMs={150} />
        );
      });

      const root = testRenderer!.root;
      const image = root.findByProps({ testID: 'pet-sprite-image' });

      // Frame inicial 0 (Fila 1 -> translateY: -100)
      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transform: [{ translateX: 0 }, { translateY: -100 }],
          }),
        ])
      );

      // Frame 1 (+150ms)
      act(() => {
        jest.advanceTimersByTime(150);
      });
      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transform: [{ translateX: -100 }, { translateY: -100 }],
          }),
        ])
      );

      // Frame 2 (+150ms)
      act(() => {
        jest.advanceTimersByTime(150);
      });
      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transform: [{ translateX: -200 }, { translateY: -100 }],
          }),
        ])
      );

      // Frame 3 (+150ms)
      act(() => {
        jest.advanceTimersByTime(150);
      });
      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transform: [{ translateX: -300 }, { translateY: -100 }],
          }),
        ])
      );

      // Frame 0 (bucle infinito al siguiente tick)
      act(() => {
        jest.advanceTimersByTime(150);
      });
      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transform: [{ translateX: 0 }, { translateY: -100 }],
          }),
        ])
      );
    });

    it('excepción para "ghost": se detiene permanentemente en el frame 3', () => {
      const size = 100;
      let testRenderer: any;
      act(() => {
        testRenderer = renderer.create(
          <PetSprite mood="ghost" size={size} frameDurationMs={150} />
        );
      });

      const root = testRenderer!.root;
      const image = root.findByProps({ testID: 'pet-sprite-image' });

      // Fila 4 para 'ghost' -> translateY: -400
      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transform: [{ translateX: 0 }, { translateY: -400 }],
          }),
        ])
      );

      // Avanzar 3 frames (3 * 150ms = 450ms) para llegar al frame 3
      act(() => {
        jest.advanceTimersByTime(450);
      });

      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transform: [{ translateX: -300 }, { translateY: -400 }],
          }),
        ])
      );

      // Avanzar más tiempo (e.g. 1000ms más) -> Debe permanecer en el frame 3 sin repetir
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transform: [{ translateX: -300 }, { translateY: -400 }],
          }),
        ])
      );
    });

    it('reinicia el frame a 0 cuando la propiedad mood cambia', () => {
      const size = 100;
      let testRenderer: any;
      act(() => {
        testRenderer = renderer.create(
          <PetSprite mood="happy" size={size} frameDurationMs={150} />
        );
      });

      // Avanzar al frame 2
      act(() => {
        jest.advanceTimersByTime(300);
      });

      const root = testRenderer!.root;
      let image = root.findByProps({ testID: 'pet-sprite-image' });
      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transform: [{ translateX: -200 }, { translateY: 0 }],
          }),
        ])
      );

      // Cambiar mood a 'sad'
      act(() => {
        testRenderer.update(
          <PetSprite mood="sad" size={size} frameDurationMs={150} />
        );
      });

      image = root.findByProps({ testID: 'pet-sprite-image' });
      // Debe reiniciarse a frame 0 (translateX: 0) y fila 3 (translateY: -300)
      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transform: [{ translateX: 0 }, { translateY: -300 }],
          }),
        ])
      );
    });

    it('soporta desplazamiento mediante posicionamiento absoluto (left/top)', () => {
      const size = 120;
      let testRenderer: any;
      act(() => {
        testRenderer = renderer.create(
          <PetSprite
            mood="confused"
            size={size}
            positioning="absolute"
            frameDurationMs={150}
          />
        );
      });

      const root = testRenderer!.root;
      const image = root.findByProps({ testID: 'pet-sprite-image' });

      // Fila 2 -> top: -240, left: 0
      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            left: 0,
            top: -240,
          }),
        ])
      );

      // Avanzar al frame 1
      act(() => {
        jest.advanceTimersByTime(150);
      });

      expect(image.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            left: -120,
            top: -240,
          }),
        ])
      );
    });
  });
});
