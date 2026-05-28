import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonItem } from './SkeletonItem';
import { Colors } from '../../constants/colors';

export const HabitItemSkeleton = () => {
  return (
    <View style={styles.container}>
      <View style={styles.leftContent}>
        <SkeletonItem width={48} height={48} borderRadius={24} style={styles.iconSkeleton} />
        <View style={styles.textContainer}>
          <SkeletonItem width="60%" height={20} borderRadius={6} style={styles.titleSkeleton} />
          <View style={styles.metadataRow}>
            <SkeletonItem width={50} height={16} borderRadius={4} style={styles.metadataSkeleton} />
            <SkeletonItem width={40} height={16} borderRadius={4} />
          </View>
        </View>
      </View>
      <SkeletonItem width={28} height={28} borderRadius={14} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginHorizontal: 16, // Para HabitsScreen, pero en HomeScreen el padding de FlatList lo ajusta
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconSkeleton: {
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleSkeleton: {
    marginBottom: 8,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metadataSkeleton: {
    marginRight: 12,
  },
});
