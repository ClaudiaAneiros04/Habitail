import React from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { Colors } from '../../constants/colors';
import { Pet, PetState } from '../../types';

interface PetDisplayProps {
  pet: Pet | null;
}

/**
 * PetDisplay Component
 * Responsable de renderizar el estado visual de la mascota (el gato).
 * Muestra información como su nivel, vida, experiencia y un avatar/emoji basado en su estado.
 */
export default function PetDisplay({ pet }: PetDisplayProps) {
  if (!pet) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyText}>Cargando mascota...</Text>
      </View>
    );
  }

  // Calculamos el porcentaje de experiencia para la barra de XP
  const xpPercentage = (pet.xp / pet.xpParaSiguienteNivel) * 100;

  /**
   * Obtiene la representación visual (emoji de momento) para el estado del gato.
   * En el futuro, aquí se gestionarán los assets reales (ej. imágenes PNG/GIF).
   */
  const getPetAvatar = (state: PetState) => {
    switch (state) {
      case PetState.ABSENT:
        return '👻';
      case PetState.SAD:
        return '😿';
      case PetState.CONFUSED:
        return '🙀';
      case PetState.CHEERING:
        return '😽';
      case PetState.HAPPY:
        return '😻';
      default:
        return '😺';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header de la mascota: Nivel y Vida */}
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

      {/* Avatar de la mascota */}
      <View style={styles.avatarContainer}>
        <Text style={styles.emojiAvatar}>{getPetAvatar(pet.estadoActual)}</Text>
      </View>

      {/* Barra de Experiencia */}
      <View style={styles.xpContainer}>
        <View style={styles.xpHeader}>
          <Text style={styles.xpText}>XP</Text>
          <Text style={styles.xpText}>{pet.xp} / {pet.xpParaSiguienteNivel}</Text>
        </View>
        <View style={styles.xpBarBackground}>
          <View style={[styles.xpBarFill, { width: `${xpPercentage}%` }]} />
        </View>
      </View>
    </View>
  );
}

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
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 4,
    borderColor: Colors.primary + '20',
  },
  emojiAvatar: {
    fontSize: 70,
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
