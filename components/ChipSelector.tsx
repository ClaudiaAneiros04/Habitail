import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Theme } from '../constants/theme';

interface Props {
  label: string;
  /** Optional icon name from Ionicons to display alongside the label */
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}

/**
 * ChipSelector — componente reutilizable y agnóstico al dominio.
 * 
 * Recibe `label`, `icon` (opcional), `selected` y `onPress`.
 * No conoce conceptos de negocio como "categoría" o "hábito".
 * 
 * Accesibilidad: utiliza `accessibilityRole="checkbox"` y
 * `accessibilityState={{ checked }}` para que TalkBack/VoiceOver
 * comuniquen el estado de selección semánticamente.
 */
export function ChipSelector({ label, icon, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.selectedContainer]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={20}
          color={selected ? Colors.surface : Theme.colors.textSecondary}
          style={styles.leadingIcon}
        />
      )}
      <Text style={[styles.text, selected && styles.selectedText]}>{label}</Text>
      {selected && (
        <View style={styles.checkContainer}>
          <Ionicons name="checkmark" size={16} color={Colors.surface} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    margin: Theme.spacing.xs,
    /**
     * Elevación sutil para dar profundidad al chip no seleccionado,
     * reforzando la jerarquía visual frente al fondo de la pantalla.
     */
    ...Theme.shadows.soft,
  },
  selectedContainer: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Theme.shadows.medium,
  },
  text: {
    fontSize: 15,
    color: Theme.colors.text,
    fontWeight: '500',
    flex: 1,
  },
  selectedText: {
    color: Colors.surface,
    fontWeight: '600',
  },
  leadingIcon: {
    marginRight: Theme.spacing.sm,
  },
  checkContainer: {
    marginLeft: Theme.spacing.sm,
  },
});
