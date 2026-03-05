import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SelectedFile } from '../types';
import { makeOutputName } from '../utils/subtitleParser';
import { colors } from '../styles/theme';

interface FileSelectorProps {
  selectedFile: SelectedFile | null;
  disabled?: boolean;
  onPickFile: () => void;
}

export function FileSelector({
  selectedFile,
  disabled,
  onPickFile,
}: FileSelectorProps) {
  return (
    <>
      <TouchableOpacity
        style={[styles.fileButton, disabled && styles.disabled]}
        onPress={onPickFile}
        disabled={disabled}
      >
        <Text style={styles.fileIcon}>{selectedFile ? '📄' : '📂'}</Text>
        <Text style={styles.fileButtonMain}>
          {selectedFile ? selectedFile.name : 'Tap to select file'}
        </Text>
        {!selectedFile && (
          <Text style={styles.fileButtonFormats}>.srt  ·  .ass  ·  .vtt</Text>
        )}
      </TouchableOpacity>

      {selectedFile && (
        <View style={styles.fileInfo}>
          <View style={styles.fileInfoRow}>
            <Text style={styles.fileInfoArrow}>↑</Text>
            <Text style={styles.fileInfoValue} numberOfLines={1}>
              {selectedFile.name}
            </Text>
          </View>
          <View style={[styles.fileInfoRow, { marginTop: 6 }]}>
            <Text style={[styles.fileInfoArrow, { color: colors.green }]}>↓</Text>
            <Text
              style={[styles.fileInfoValue, { color: colors.green }]}
              numberOfLines={1}
            >
              {makeOutputName(selectedFile.name)}
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fileButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#7c6fff55',
    borderStyle: 'dashed',
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  fileIcon: {
    fontSize: 32,
  },
  fileButtonMain: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  fileButtonFormats: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  disabled: {
    opacity: 0.4,
  },

  // File info
  fileInfo: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fileInfoArrow: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    width: 16,
  },
  fileInfoValue: {
    color: colors.purpleLight,
    fontSize: 12,
    flex: 1,
  },
});
