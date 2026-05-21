import { useState, useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export function useNotificationPermission() {
  const [status, setStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');

  useEffect(() => {
    if (Platform.OS === 'web') {
      setStatus('granted');
      return;
    }

    const checkPermissions = async () => {
      try {
        const { status: currentStatus } = await Notifications.getPermissionsAsync();
        setStatus(currentStatus);
      } catch (error) {
        console.warn('[useNotificationPermission] Error al obtener permisos iniciales:', error);
      }
    };

    checkPermissions();

    // Escucha cambios en el estado de la aplicación para detectar 
    // si el usuario revocó o concedió permisos desde los Ajustes del sistema.
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        try {
          const { status: currentStatus } = await Notifications.getPermissionsAsync();
          setStatus(currentStatus);
        } catch (error) {
          console.warn('[useNotificationPermission] Error al actualizar permisos en AppState activo:', error);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'web') {
      setStatus('granted');
      return true;
    }

    try {
      const { status: requestStatus } = await Notifications.requestPermissionsAsync();
      setStatus(requestStatus);
      return requestStatus === 'granted';
    } catch (error) {
      console.warn('[useNotificationPermission] Error al solicitar permisos:', error);
      setStatus('denied');
      return false;
    }
  };

  return {
    status,
    requestPermissions,
  };
}

