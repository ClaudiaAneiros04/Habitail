import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonItem } from './SkeletonItem';
import { Theme } from '../../constants/theme';

export const HeatmapSkeleton = () => {
  return (
    <View style={styles.container}>
      <SkeletonItem width={140} height={20} borderRadius={4} style={styles.titleSkeleton} />
      <View style={styles.card}>
        <SkeletonItem width="100%" height={220} borderRadius={16} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Theme.spacing.lg,
  },
  titleSkeleton: {
    marginBottom: Theme.spacing.md,
    marginLeft: Theme.spacing.xs,
  },
  card: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: 24,
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    ...Theme.shadows.soft,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    minHeight: 150,
  },
});
