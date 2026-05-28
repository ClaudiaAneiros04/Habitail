import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, AccessibilityInfo, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface SkeletonItemProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: any;
}

export const SkeletonItem: React.FC<SkeletonItemProps> = ({ 
  width = '100%', 
  height = 20, 
  borderRadius = 8,
  style 
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [isReduceMotion, setIsReduceMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let loop: Animated.CompositeAnimation;

    const setup = async () => {
      try {
        const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
        if (isMounted) setIsReduceMotion(reduceMotion);

        if (!reduceMotion) {
          loop = Animated.loop(
            Animated.timing(animatedValue, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            })
          );
          loop.start();
        }
      } catch (e) {
        // Fallback si falla la API
      }
    };

    setup();
    return () => {
      isMounted = false;
      if (loop) loop.stop();
    };
  }, [animatedValue]);

  // Interpolación genérica de -100% a 100% del contenedor padre si fuera posible, 
  // pero translateX no soporta porcentajes en Animated de RN fácilmente sin onLayout.
  // Usamos una traslación amplia que cubre la mayoría de las pantallas.
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-400, 400], 
  });

  return (
    <View style={[styles.container, { width, height, borderRadius }, style]}>
      {!isReduceMotion && (
        <AnimatedLinearGradient
          colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.inactive + '50', // Color base
    overflow: 'hidden',
  },
});
