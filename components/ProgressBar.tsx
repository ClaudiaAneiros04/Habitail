import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { Colors } from '../constants/colors';

/**
 * Propiedades para el componente ProgressBar.
 * @property {number} progress - Valor entre 0 y 1 que indica el progreso actual.
 * @property {string} [label] - Texto descriptivo opcional para mostrar sobre la barra.
 */
interface ProgressBarProps {
  progress: number; // 0 to 1
  label?: string;
}

/**
 * Componente que renderiza una barra de progreso animada.
 * Utiliza Animated de React Native para suavizar las transiciones cuando cambia el porcentaje.
 * 
 * @param {ProgressBarProps} props - Propiedades del componente.
 * @returns {JSX.Element} React Element de la barra de progreso.
 */
export default function ProgressBar({ progress, label }: ProgressBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress, animatedWidth]);

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.percentage}>{Math.round(progress * 100)}%</Text>
        </View>
      )}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: animatedWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  percentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  track: {
    height: 12,
    backgroundColor: Colors.inactive,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
});
