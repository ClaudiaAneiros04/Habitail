import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { PetSprite, PetMood, getRowForMood, isGhostMood } from './PetSprite';
import { Colors } from '../../constants/colors';

interface MoodOption {
  key: PetMood;
  label: string;
  emoji: string;
  description: string;
  row: number;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    key: 'happy',
    label: 'Feliz',
    emoji: '💖',
    description: 'Fila 0 · Saltando con corazones',
    row: 0,
  },
  {
    key: 'cheering',
    label: 'Animando',
    emoji: '🎉',
    description: 'Fila 1 · Saludando alegre',
    row: 1,
  },
  {
    key: 'confused',
    label: 'Confundido',
    emoji: '❓',
    description: 'Fila 2 · Signos de interrogación',
    row: 2,
  },
  {
    key: 'sad',
    label: 'Triste',
    emoji: '😢',
    description: 'Fila 3 · Sentado llorando',
    row: 3,
  },
  {
    key: 'ghost',
    label: 'Fantasma',
    emoji: '👻',
    description: 'Fila 4 · Se detiene en frame 3',
    row: 4,
  },
];

const SIZES = [100, 150, 200];

/**
 * Pantalla interactiva de demostración para el componente PetSprite.
 * Permite cambiar de estado de ánimo en tiempo real con TouchableOpacity,
 * alternar tamaños, y verificar la excepción del estado 'ghost'.
 */
export const PetSpriteDemoScreen: React.FC = () => {
  const [currentMood, setCurrentMood] = useState<PetMood>('happy');
  const [size, setSize] = useState<number>(150);
  const [positioning, setPositioning] = useState<'transform' | 'absolute'>('transform');
  // Key para forzar el re-montaje/reinicio de la animación si se desea probar 'ghost' desde cero
  const [resetKey, setResetKey] = useState<number>(0);

  const activeRow = getRowForMood(currentMood);
  const isGhost = isGhostMood(currentMood);

  const handleSelectMood = (mood: PetMood) => {
    setCurrentMood(mood);
    setResetKey((prev) => prev + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera */}
        <View style={styles.header}>
          <Text style={styles.title}>PetSprite Demo</Text>
          <Text style={styles.subtitle}>
            Spritesheet de 4 columnas x 5 filas en React Native
          </Text>
        </View>

        {/* Tarjeta del Sprite Animado */}
        <View style={styles.previewCard}>
          <View style={styles.statusRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Fila: {activeRow}</Text>
            </View>
            <View
              style={[
                styles.badge,
                isGhost ? styles.badgeWarning : styles.badgeSuccess,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  isGhost ? styles.badgeTextWarning : styles.badgeTextSuccess,
                ]}
              >
                {isGhost ? 'Ghost (Detiene en frame 3)' : 'Bucle continuo (4 frames)'}
              </Text>
            </View>
          </View>

          {/* Renderizado de la Mascota */}
          <View style={[styles.spriteWrapper, { width: size + 20, height: size + 20 }]}>
            <PetSprite
              key={`${currentMood}-${resetKey}`}
              mood={currentMood}
              size={size}
              positioning={positioning}
            />
          </View>

          <Text style={styles.activeMoodLabel}>
            Estado activo: <Text style={styles.activeMoodHighlight}>{String(currentMood).toUpperCase()}</Text>
          </Text>

          {isGhost && (
            <TouchableOpacity
              style={styles.replayButton}
              onPress={() => setResetKey((k) => k + 1)}
              activeOpacity={0.8}
            >
              <Text style={styles.replayButtonText}>🔄 Reiniciar animación fantasma</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Selector de Estado de Ánimo (Botones TouchableOpacity) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selecciona el Estado de Ánimo (mood)</Text>
          <View style={styles.moodButtonsContainer}>
            {MOOD_OPTIONS.map((item) => {
              const isSelected = currentMood === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.moodButton,
                    isSelected && styles.moodButtonActive,
                  ]}
                  onPress={() => handleSelectMood(item.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moodEmoji}>{item.emoji}</Text>
                  <View style={styles.moodTextContainer}>
                    <Text
                      style={[
                        styles.moodLabel,
                        isSelected && styles.moodLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.moodDescription,
                        isSelected && styles.moodDescriptionActive,
                      ]}
                    >
                      {item.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.activeIndicator} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Controles de Configuración (Tamaño y Modo de Posicionamiento) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tamaño del Frame (px)</Text>
          <View style={styles.pillRow}>
            {SIZES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.pill, size === s && styles.pillActive]}
                onPress={() => setSize(s)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pillText,
                    size === s && styles.pillTextActive,
                  ]}
                >
                  {s} x {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Método de Desplazamiento</Text>
          <View style={styles.pillRow}>
            <TouchableOpacity
              style={[
                styles.pill,
                positioning === 'transform' && styles.pillActive,
              ]}
              onPress={() => setPositioning('transform')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.pillText,
                  positioning === 'transform' && styles.pillTextActive,
                ]}
              >
                transform: [{`translateX, translateY`}]
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pill,
                positioning === 'absolute' && styles.pillActive,
              ]}
              onPress={() => setPositioning('absolute')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.pillText,
                  positioning === 'absolute' && styles.pillTextActive,
                ]}
              >
                absolute (top / left)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.secondaryText,
    marginTop: 4,
    textAlign: 'center',
  },
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  badgeWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondaryText,
  },
  badgeTextSuccess: {
    color: Colors.success,
  },
  badgeTextWarning: {
    color: Colors.warning,
  },
  spriteWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  activeMoodLabel: {
    fontSize: 15,
    color: Colors.secondaryText,
    marginTop: 8,
  },
  activeMoodHighlight: {
    fontWeight: '700',
    color: Colors.primary,
  },
  replayButton: {
    marginTop: 12,
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  replayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  moodButtonsContainer: {
    gap: 10,
  },
  moodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  moodButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: '#f5f3ff',
  },
  moodEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  moodTextContainer: {
    flex: 1,
  },
  moodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  moodLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  moodDescription: {
    fontSize: 12,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  moodDescriptionActive: {
    color: '#6366f1',
  },
  activeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  pillTextActive: {
    color: '#ffffff',
  },
});

export default PetSpriteDemoScreen;
