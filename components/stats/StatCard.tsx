import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../../constants/theme';

interface StatCardProps {
  /** Título descriptivo de la estadística */
  title: string;
  /** Valor de la estadística (puede ser número o texto formateado) */
  value: string | number;
}

/**
 * Componente StatCard que muestra una estadística individual.
 * Utiliza un diseño de tarjeta con bordes redondeados y sombras suaves.
 */
export const StatCard: React.FC<StatCardProps> = ({ title, value }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.cardBackground,
    padding: Theme.spacing.md,
    borderRadius: 16,
    flex: 1,
    margin: Theme.spacing.xs,
    // Aplicamos la sombra definida en el tema
    ...Theme.shadows.soft,
  },
  title: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: Theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 20,
    color: Theme.colors.text,
    fontWeight: 'bold',
  },
});
