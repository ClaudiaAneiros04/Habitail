import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { PetState } from '../../types';
import { usePetStore } from '../../store/usePetStore';

/**
 * MiniPet Component (Widget)
 * Un componente reducido (60x60) que muestra la cara de la mascota,
 * su barra de XP y un indicador de salud baja. Actúa como acceso directo a la PetScreen.
 */
export const MiniPet = () => {
  const router = useRouter();
  const { pet } = usePetStore();
  
  // Estado local para manejar transiciones suaves
  const [displayedState, setDisplayedState] = useState<PetState | null>(pet ? pet.estadoActual : null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Efecto para transición suave de estados (Fade In/Out)
  useEffect(() => {
    if (pet && displayedState && pet.estadoActual !== displayedState) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setDisplayedState(pet.estadoActual);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    } else if (pet && !displayedState) {
      setDisplayedState(pet.estadoActual);
    }
  }, [pet?.estadoActual, displayedState, fadeAnim]);

  if (!pet || !displayedState) return null;

  /**
   * Obtiene el avatar (emoji) según el estado.
   * Reutilizamos la lógica visual de PetDisplay.
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

  const xpPercentage = (pet.xp / pet.xpParaSiguienteNivel) * 100;
  const isHealthLow = pet.vida < 30;

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={() => router.push('/pet' as any)}
      activeOpacity={0.8}
    >
      {/* Contenedor de la cara con "Efecto Zoom" */}
      <View style={styles.faceWrapper}>
        <Animated.View style={[styles.faceContainer, { opacity: fadeAnim }]}>
          {/* Usamos un fontSize grande y posicionamiento para centrar la cara del emoji */}
          <Text style={styles.emojiFace}>{getPetAvatar(displayedState)}</Text>
        </Animated.View>
        
        {/* Badge de salud baja (Punto rojo) */}
        {isHealthLow && <View style={styles.healthBadge} />}
      </View>

      {/* Mini barra de progreso XP */}
      <View style={styles.miniXpBar}>
        <View style={[styles.xpFill, { width: `${Math.min(100, Math.max(0, xpPercentage))}%` }]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 60,
    alignItems: 'center',
  },
  faceWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary + '30',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  faceContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiFace: {
    fontSize: 50, // Tamaño grande para que parezca un zoom en la cara
    lineHeight: 60,
    textAlign: 'center',
  },
  healthBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30', // Rojo sistema
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 10,
  },
  miniXpBar: {
    width: '80%',
    height: 4,
    backgroundColor: Colors.background,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
});
