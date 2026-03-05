import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { colors } from '../styles/theme';

interface ProcessingLogProps {
  log: string;
}

export function ProcessingLog({ log }: ProcessingLogProps) {
  const logRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (log) {
      setTimeout(() => logRef.current?.scrollToEnd({ animated: false }), 80);
    }
  }, [log]);

  if (!log) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.header}>LOG</Text>
      <ScrollView ref={logRef} style={styles.scrollView} nestedScrollEnabled>
        <Text style={styles.text}>{log}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: colors.card,
    color: colors.purpleLight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scrollView: {
    backgroundColor: colors.bg,
    maxHeight: 260,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  text: {
    color: colors.cyan,
    fontSize: 11,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
    lineHeight: 20,
  },
});
