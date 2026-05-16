import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Theme } from '../constants/theme';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function ChipSelector({ label, selected, onPress }: Props) {
  return (
    <TouchableOpacity 
      style={[styles.container, selected && styles.selectedContainer]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {selected && <Ionicons name="checkmark" size={16} color={Colors.surface} style={styles.icon} />}
      <Text style={[styles.text, selected && styles.selectedText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    margin: Theme.spacing.xs,
  },
  selectedContainer: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  text: {
    fontSize: 14,
    color: Theme.colors.text,
    fontWeight: '500',
  },
  selectedText: {
    color: Colors.surface,
    fontWeight: '600',
  },
  icon: {
    marginRight: Theme.spacing.xs,
  },
});
