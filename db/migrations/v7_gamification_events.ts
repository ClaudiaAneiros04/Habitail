import * as SQLite from 'expo-sqlite';
import { Migration } from './types';

export const migrationV7: Migration = {
  version: 7,
  name: 'gamification_events_ledger',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS gamification_events (
        eventKey TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        petId TEXT NOT NULL,
        habitId TEXT,
        logicalDate TEXT NOT NULL,
        eventType TEXT NOT NULL,
        healthDelta INTEGER NOT NULL,
        pointsDelta INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        isReverted INTEGER NOT NULL DEFAULT 0,
        revertedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (petId) REFERENCES pets (id) ON DELETE CASCADE,
        FOREIGN KEY (habitId) REFERENCES habits (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_gamification_events_user ON gamification_events (userId);
      CREATE INDEX IF NOT EXISTS idx_gamification_events_habit_date ON gamification_events (habitId, logicalDate);
    `);
  },
};
