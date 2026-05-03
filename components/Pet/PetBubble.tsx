import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { PetState } from '../../types';
import { Colors } from '../../constants/colors';

interface PetBubbleProps {
  state: PetState;
}

const MESSAGES: Record<PetState, string[]> = {
  [PetState.HAPPY]: ["¡Me siento de maravilla!", "¡Gracias por esforzarte!", "¡Sigue así!", "¡Qué gran día!"],
  [PetState.CHEERING]: ["¡Tú puedes!", "¡Vamos, un poco más!", "¡Creo en ti!", "¡No te rindas!"],
  [PetState.SAD]: ["Me vendría bien un poco de atención...", "Hambre...", "Un poco triste hoy..."],
  [PetState.CONFUSED]: ["¿Qué está pasando?", "No entiendo...", "¿Eh?"],
  [PetState.ABSENT]: ["...", "zZz...", "(Se ha ido)"],
};

/**
 * PetBubble Component
 * Muestra una burbuja de texto cerca de la mascota con un mensaje aleatorio
 * dependiendo de su estado actual. Incluye una animación de levitación.
 */
export const PetBubble: React.FC<PetBubbleProps> = ({ state }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animación de levitación suave (bucle infinito)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 5,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  // Selección de mensaje aleatorio basado en el estado
  const stateMessages = MESSAGES[state] || ["Miau~"];
  const randomMessage = stateMessages[Math.floor(Math.random() * stateMessages.length)];

  return (
    <Animated.View style={[styles.bubbleContainer, { transform: [{ translateY: floatAnim }] }]}>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{randomMessage}</Text>
      </View>
      {/* Triangulito de la burbuja apuntando a la mascota */}
      <View style={styles.bubbleTail} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bubbleContainer: {
    position: 'absolute',
    top: -40,
    right: -20,
    alignItems: 'center',
    zIndex: 10,
  },
  bubble: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#eee',
    maxWidth: 150,
  },
  bubbleText: {
    fontSize: 12,
    color: Colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  bubbleTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
    marginTop: -1, // Para que se solape ligeramente con el borde de la burbuja
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
});
