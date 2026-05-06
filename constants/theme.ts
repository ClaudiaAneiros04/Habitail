import { Colors } from './colors';

/**
 * Objeto de tema global de la aplicación.
 * Define la paleta de colores, espaciados y sombras para mantener la consistencia visual.
 */
export const Theme = {
  colors: {
    primary: Colors.primary,
    background: Colors.background,
    cardBackground: Colors.surface,
    text: Colors.text,
    textSecondary: '#64748b', // Slate 500
    border: '#e2e8f0',       // Slate 200
    inactive: Colors.inactive,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  shadows: {
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
  },
};
