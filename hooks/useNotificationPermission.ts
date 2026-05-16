import { useState } from 'react';

export function useNotificationPermission() {
  const [status, setStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');

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
