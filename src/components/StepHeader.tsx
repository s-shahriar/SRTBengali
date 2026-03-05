import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../styles/theme';

interface StepHeaderProps {
  number: string;
  title: string;
}

export function StepHeader({ number, title }: StepHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.number}>{number}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 10,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: colors.sub,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
