import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../constants/colors';
import { Pet, PetState } from '../../types';
import { PetBubble } from './PetBubble';

interface PetDisplayProps {
  pet: Pet | null;
}

export interface PetDisplayRef {
  /**
   * Dispara la animación de mascota feliz y muestra un texto flotante de recompensa.
   * @param rewardText Texto a mostrar (ej. "+10 ❤️" o "+5 XP")
   */
  onCompleteHabit: (rewardText: string) => void;
}

/**
 * Componente interno para mostrar un texto flotante (+10 ❤️, +5 XP)
 * que sube y se desvanece suavemente.
 */
const FloatingDelta = ({ text, onComplete }: { text: string, onComplete: () => void }) => {
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateYAnim, {
        toValue: -60,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete();
    });
  }, [translateYAnim, opacityAnim, onComplete]);

  return (
    <Animated.Text style={[
      styles.floatingDelta,
      {
        opacity: opacityAnim,
        transform: [{ translateY: translateYAnim }]
      }
    ]}>
      {text}
    </Animated.Text>
  );
};

/**
 * PetDisplay Component
 * Responsable de renderizar el estado visual de la mascota (el gato).
 * Maneja transiciones de estado, animaciones de recompensas y mensajes dinámicos.
 */
const PetDisplay = forwardRef<PetDisplayRef, PetDisplayProps>(({ pet }, ref) => {
  // Estado local para manejar el fade-out/fade-in suave entre estados de mascota
  const [displayedState, setDisplayedState] = useState<PetState | null>(pet ? pet.estadoActual : null);
  
  // Animaciones
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Textos flotantes
  const [floatingTexts, setFloatingTexts] = useState<{ id: number, text: string }[]>([]);

  // Efecto para transición suave de estados
  useEffect(() => {
    if (pet && displayedState && pet.estadoActual !== displayedState) {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Cambiar el estado una vez que está invisible
        setDisplayedState(pet.estadoActual);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    } else if (pet && !displayedState) {
      setDisplayedState(pet.estadoActual);
    }
  }, [pet?.estadoActual, displayedState, fadeAnim]);

  // Exponer métodos imperativos (trigger animations) a componentes padres
  useImperativeHandle(ref, () => ({
    onCompleteHabit: (rewardText: string) => {
      // 1. Efecto de "Flash" o partículas de recompensa
      flashAnim.setValue(1);
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start();

      // 2. Animación de "Salto" (Bounce)
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -30, duration: 200, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: -15, duration: 150, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();

      // 3. Añadir texto flotante (Delta)
      const newId = Date.now() + Math.random();
      setFloatingTexts(prev => [...prev, { id: newId, text: rewardText }]);
    }
  }));

  if (!pet || !displayedState) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyText}>Cargando mascota...</Text>
      </View>
    );
  }

  const xpPercentage = (pet.xp / pet.xpParaSiguienteNivel) * 100;

  /**
   * Representación visual según estado.
   * En un futuro, se sustituirá por assets/imágenes de la mascota.
   */
  const getPetAvatar = (state: PetState) => {
    switch (state) {
      case PetState.ABSENT: return '👻';
      case PetState.SAD: return '😿';
      case PetState.CONFUSED: return '🙀';
      case PetState.CHEERING: return '😽';
      case PetState.HAPPY: return '😻';
      default: return '😺';
    }
  };

  const removeFloatingText = (id: number) => {
    setFloatingTexts(prev => prev.filter(item => item.id !== id));
  };

  return (
    <View style={styles.container}>
      {/* Header: Nivel y Vida */}
      <View style={styles.statsHeader}>
        <View style={styles.statBadge}>
          <Text style={styles.statLabel}>Nvl</Text>
          <Text style={styles.statValue}>{pet.nivel}</Text>
        </View>
        <View style={[styles.statBadge, styles.healthBadge]}>
          <Text style={styles.statLabel}>❤️</Text>
          <Text style={styles.statValue}>{pet.vida}/100</Text>
        </View>
      </View>

      {/* Contenedor interactivo de la Mascota */}
      <View style={styles.petInteractionArea}>
        {/* Flash background effect */}
        <Animated.View style={[
          styles.flashEffect,
          {
            opacity: flashAnim,
            transform: [{ 
              scale: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 1] }) 
            }]
          }
        ]} />

        {/* Mascota en sí (Avatar) y su burbuja */}
        <Animated.View style={[
          styles.avatarContainer, 
          { 
            opacity: fadeAnim,
            transform: [{ translateY: bounceAnim }]
          }
        ]}>
          {/* Burbuja flotante con mensaje aleatorio según estado */}
          <PetBubble state={displayedState} />

          {/* El propio Avatar/Emoji */}
          <Text style={styles.emojiAvatar}>{getPetAvatar(displayedState)}</Text>

          {/* Textos de recompensa flotantes (ej. +10 XP) */}
          {floatingTexts.map(item => (
            <FloatingDelta 
              key={item.id} 
              text={item.text} 
              onComplete={() => removeFloatingText(item.id)} 
            />
          ))}
        </Animated.View>
      </View>

      {/* Barra de Experiencia */}
      <View style={styles.xpContainer}>
        <View style={styles.xpHeader}>
          <Text style={styles.xpText}>XP</Text>
          <Text style={styles.xpText}>{pet.xp} / {pet.xpParaSiguienteNivel}</Text>
        </View>
        <View style={styles.xpBarBackground}>
          <View style={[styles.xpBarFill, { width: `${Math.min(100, Math.max(0, xpPercentage))}%` }]} />
        </View>
      </View>
    </View>
  );
});

export default PetDisplay;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    marginVertical: 10,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.text,
    opacity: 0.6,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  healthBadge: {
    backgroundColor: '#FFE5E5',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginRight: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  petInteractionArea: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: Colors.primary + '20',
    zIndex: 2,
  },
  emojiAvatar: {
    fontSize: 70,
  },
  flashEffect: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 215, 0, 0.5)', // Destello dorado
    zIndex: 1,
  },
  floatingDelta: {
    position: 'absolute',
    top: 20,
    fontSize: 20,
    fontWeight: '900',
    color: '#FF4500',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    zIndex: 3,
  },
  xpContainer: {
    width: '100%',
    marginTop: 10,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text,
    opacity: 0.7,
  },
  xpBarBackground: {
    height: 10,
    backgroundColor: Colors.background,
    borderRadius: 5,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 5,
  },
});
