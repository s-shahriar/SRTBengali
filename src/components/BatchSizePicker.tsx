import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { BATCH_SIZE_OPTIONS, BATCH_SIZE } from '../constants/config';
import { colors } from '../styles/theme';

interface BatchSizePickerProps {
  selectedSize: number;
  visible: boolean;
  disabled?: boolean;
  onSelect: (size: number) => void;
  onClose: () => void;
  onOpen: () => void;
}

export function BatchSizePicker({
  selectedSize,
  visible,
  disabled,
  onSelect,
  onClose,
  onOpen,
}: BatchSizePickerProps) {
  const selected = BATCH_SIZE_OPTIONS.find(o => o.value === selectedSize)
    ?? BATCH_SIZE_OPTIONS.find(o => o.value === BATCH_SIZE)!;

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={onOpen}
        disabled={disabled}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.buttonText}>{selected.label}</Text>
          <Text style={styles.buttonInfo}>{selected.description}</Text>
        </View>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Smaller batches = more API calls & longer time, but fewer failures.{'\n'}
        Larger batches = faster, but higher mismatch risk per batch.
      </Text>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Batch Size</Text>
            <Text style={styles.sheetSubtitle}>
              Lines sent per API call. Smaller = safer but slower.
            </Text>
            {BATCH_SIZE_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  option.value === selectedSize && styles.optionActive,
                ]}
                onPress={() => onSelect(option.value)}
              >
                <View style={styles.optionHeader}>
                  <Text
                    style={[
                      styles.optionLabel,
                      option.value === selectedSize && { color: colors.purple },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.value === BATCH_SIZE && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.optionInfo}>{option.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  buttonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonInfo: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  chevron: {
    color: colors.purpleLight,
    fontSize: 20,
  },
  hint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: '#000000cc',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 44,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sheetSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 18,
    lineHeight: 18,
  },
  option: {
    backgroundColor: colors.input,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: {
    borderColor: colors.purple,
    borderWidth: 2,
    backgroundColor: `${colors.purple}11`,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  optionInfo: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  defaultBadge: {
    backgroundColor: `${colors.cyan}22`,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${colors.cyan}55`,
  },
  defaultBadgeText: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '700',
  },
});
