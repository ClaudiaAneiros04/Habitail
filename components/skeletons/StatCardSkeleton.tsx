import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonItem } from './SkeletonItem';
import { Theme } from '../../constants/theme';

export const StatCardSkeleton = () => {
  return (
    <View style={styles.card}>
      <SkeletonItem width="60%" height={14} borderRadius={4} style={styles.titleSkeleton} />
      <SkeletonItem width="40%" height={24} borderRadius={6} />
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
    ...Theme.shadows.soft,
  },
  titleSkeleton: {
    marginBottom: Theme.spacing.md,
  },
});
