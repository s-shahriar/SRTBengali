import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { GeminiModel } from '../types';
import { MODELS } from '../constants/config';
import { colors } from '../styles/theme';

interface ModelPickerProps {
  selectedModel: GeminiModel;
  visible: boolean;
  disabled?: boolean;
  onSelect: (model: GeminiModel) => void;
  onClose: () => void;
  onOpen: () => void;
}

export function ModelPicker({
  selectedModel,
  visible,
  disabled,
  onSelect,
  onClose,
  onOpen,
}: ModelPickerProps) {
  return (
    <>
      {/* Model selection button */}
      <TouchableOpacity
        style={styles.button}
        onPress={onOpen}
        disabled={disabled}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.buttonText}>{selectedModel.label}</Text>
          <Text style={styles.buttonInfo}>{selectedModel.info}</Text>
        </View>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      {/* Model picker modal */}
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
            <Text style={styles.sheetTitle}>Select Model</Text>
            {MODELS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.modelOption,
                  m.id === selectedModel.id && styles.modelOptionActive,
                ]}
                onPress={() => onSelect(m)}
              >
                <View style={styles.modelOptionHeader}>
                  <Text
                    style={[
                      styles.modelOptionLabel,
                      m.id === selectedModel.id && { color: colors.purple },
                    ]}
                  >
                    {m.label}
                  </Text>
                  {m.id === MODELS[0].id && (
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestBadgeText}>BEST</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modelOptionInfo}>{m.info}</Text>
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

  // Modal styles
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
    marginBottom: 18,
  },
  modelOption: {
    backgroundColor: colors.input,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modelOptionActive: {
    borderColor: colors.purple,
    borderWidth: 2,
    backgroundColor: `${colors.purple}11`,
  },
  modelOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modelOptionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modelOptionInfo: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  bestBadge: {
    backgroundColor: `${colors.cyan}22`,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${colors.cyan}55`,
  },
  bestBadgeText: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '700',
  },
});
