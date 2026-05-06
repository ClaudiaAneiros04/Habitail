import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Theme } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface HabitSelectorProps {
  /** Nombre del hábito seleccionado actualmente */
  selectedHabit: string;
  /** Función para abrir el selector/modal de hábitos */
  onSelect: () => void;
}

/**
 * Componente de cabecera que permite seleccionar el hábito para ver sus estadísticas.
 * Muestra el nombre del hábito actual y un icono para indicar que es desplegable.
 */
export const HabitSelector: React.FC<HabitSelectorProps> = ({ selectedHabit, onSelect }) => {
  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={0.8}
      onPress={onSelect}
    >
      <View style={styles.textContainer}>
        <Text style={styles.label}>Visualizando estadísticas de:</Text>
        <Text style={styles.value} numberOfLines={1}>
          {selectedHabit}
        </Text>
      </View>
      <View style={styles.iconContainer}>
        <Ionicons name="chevron-down" size={20} color={Theme.colors.primary} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.soft,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Theme.colors.text,
  },
  iconContainer: {
    backgroundColor: Theme.colors.background,
    padding: 6,
    borderRadius: 10,
    marginLeft: Theme.spacing.md,
  },
});
