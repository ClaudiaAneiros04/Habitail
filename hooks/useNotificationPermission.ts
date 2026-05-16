import { useState, useEffect } from 'react';
import { AppState } from 'react-native';

export function useNotificationPermission() {
  const [status, setStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');

  useEffect(() => {
    // Escucha cambios en el estado de la aplicación para detectar 
    // si el usuario revocó o concedió permisos desde los Ajustes del sistema.
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        // En un entorno real con expo-notifications:
        // Notifications.getPermissionsAsync().then(({ status }) => setStatus(status));
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const requestPermissions = async () => {
    // Stub implementation
    setStatus('granted');
    return true;
  };

  return {
    status,
    requestPermissions,
  };
}
