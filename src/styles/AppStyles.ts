import { StyleSheet, Platform } from 'react-native';
import { colors } from './theme';

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.purpleLight,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  headerBadge: {
    backgroundColor: `${colors.purple}22`,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${colors.purple}44`,
  },
  headerBadgeText: {
    color: colors.purpleLight,
    fontSize: 13,
    fontWeight: '600',
  },
  headerSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },

  hint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // API key
  input: {
    backgroundColor: colors.input,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 13,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.purple,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minWidth: 80,
    alignItems: 'center',
  },
  saveBtnDone: {
    backgroundColor: colors.success,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Process button
  processBtn: {
    backgroundColor: colors.purple,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: colors.purple,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  processBtnBusy: {
    backgroundColor: colors.purpleDim,
  },
  processBtnDim: {
    opacity: 0.5,
  },
  processBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
