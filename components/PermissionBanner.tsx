import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/colors';
import { Theme } from '../constants/theme';
import { useNotificationPermission } from '../hooks/useNotificationPermission';

export function PermissionBanner() {
  const { t } = useTranslation();
  const { status } = useNotificationPermission();
  const [isVisible, setIsVisible] = useState(true);

  if (status !== 'denied' || !isVisible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Ionicons name="notifications-off-outline" size={24} color={Colors.warning} style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.text}>{t('notifications.banner.denied')}</Text>
        <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.button}>
          <Text style={styles.buttonText}>{t('notifications.banner.goToSettings')}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => setIsVisible(false)} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={20} color={Theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.cardBackground,
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.md,
    padding: Theme.spacing.md,
    borderRadius: 12,
    ...Theme.shadows.soft,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  icon: {
    marginRight: Theme.spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  text: {
    fontSize: 14,
    color: Theme.colors.text,
    marginBottom: Theme.spacing.xs,
  },
  button: {
    alignSelf: 'flex-start',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  closeButton: {
    marginLeft: Theme.spacing.sm,
  },
});
