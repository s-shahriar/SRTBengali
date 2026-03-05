import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../styles/theme';

export type ViewMode = 'process' | 'files';

interface ViewToggleProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.option,
          styles.leftOption,
          activeView === 'process' && styles.activeOption,
        ]}
        onPress={() => onViewChange('process')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.optionText,
            activeView === 'process' && styles.activeText,
          ]}
        >
          Process
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.option,
          styles.rightOption,
          activeView === 'files' && styles.activeOption,
        ]}
        onPress={() => onViewChange('files')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.optionText,
            activeView === 'files' && styles.activeText,
          ]}
        >
          My Files
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 25,
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  option: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  leftOption: {
    marginRight: 2,
  },
  rightOption: {
    marginLeft: 2,
  },
  activeOption: {
    backgroundColor: colors.purple,
    shadowColor: colors.purple,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  optionText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  activeText: {
    color: '#fff',
  },
});
