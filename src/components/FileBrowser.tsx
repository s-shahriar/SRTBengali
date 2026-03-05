import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native';
import { colors } from '../styles/theme';
import {
  scanForSRTFiles,
  formatFileSize,
  formatDate,
  SRTFileInfo,
} from '../utils/fileScanner';
import { renameFile, deleteFile } from '../utils/fileManager';

interface RenameDialogState {
  visible: boolean;
  file: SRTFileInfo | null;
  newName: string;
}

export function FileBrowser() {
  const [files, setFiles] = useState<SRTFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [renameDialog, setRenameDialog] = useState<RenameDialogState>({
    visible: false,
    file: null,
    newName: '',
  });

  const loadFiles = async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const scannedFiles = await scanForSRTFiles();
      setFiles(scannedFiles);
    } catch (error: any) {
      Alert.alert('Error', `Failed to load files: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleDelete = (file: SRTFileInfo) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${file.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFile(file.uri);
              Alert.alert('Success', 'File deleted successfully');
              loadFiles();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleRenamePress = (file: SRTFileInfo) => {
    setRenameDialog({
      visible: true,
      file,
      newName: file.name,
    });
  };

  const handleRenameConfirm = async () => {
    const { file, newName } = renameDialog;
    if (!file || !newName.trim()) return;

    // Ensure the new name has the correct extension
    const extension = file.name.split('.').pop();
    let finalName = newName.trim();
    if (!finalName.toLowerCase().endsWith(`.${extension}`)) {
      finalName = `${finalName}.${extension}`;
    }

    try {
      await renameFile(file.uri, finalName);
      Alert.alert('Success', 'File renamed successfully');
      setRenameDialog({ visible: false, file: null, newName: '' });
      loadFiles();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.purple} />
        <Text style={styles.loadingText}>Scanning for subtitle files...</Text>
      </View>
    );
  }

  if (files.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.centerContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadFiles(true)}
            tintColor={colors.purple}
          />
        }
      >
        <Text style={styles.emptyIcon}>📂</Text>
        <Text style={styles.emptyText}>No subtitle files found</Text>
        <Text style={styles.emptyHint}>
          Processed files will appear here
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => loadFiles(true)}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadFiles(true)}
            tintColor={colors.purple}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {files.length} file{files.length !== 1 ? 's' : ''} found
          </Text>
        </View>

        {files.map((file, index) => (
          <View key={file.uri} style={styles.fileCard}>
            <View style={styles.fileIcon}>
              <Text style={styles.fileIconText}>
                {file.name.endsWith('.ass')
                  ? '📜'
                  : file.name.endsWith('.vtt')
                  ? '🎬'
                  : '📝'}
              </Text>
            </View>

            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={2}>
                {file.name}
              </Text>
              <Text style={styles.fileDetails}>
                {formatFileSize(file.size)} · {formatDate(file.modificationTime)}
              </Text>
            </View>

            <View style={styles.fileActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleRenamePress(file)}
              >
                <Text style={styles.actionIcon}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete(file)}
              >
                <Text style={styles.actionIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Rename Dialog */}
      {renameDialog.visible && (
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Rename File</Text>
            <TextInput
              style={styles.dialogInput}
              value={renameDialog.newName}
              onChangeText={text =>
                setRenameDialog(prev => ({ ...prev, newName: text }))
              }
              placeholder="Enter new name"
              placeholderTextColor={colors.textMuted}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogButton, styles.cancelButton]}
                onPress={() =>
                  setRenameDialog({ visible: false, file: null, newName: '' })
                }
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogButton, styles.confirmButton]}
                onPress={handleRenameConfirm}
              >
                <Text style={styles.confirmButtonText}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 50,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },

  // Loading
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 16,
  },

  // Empty state
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: colors.purple,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: colors.purple,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Header
  header: {
    marginBottom: 16,
  },
  headerText: {
    color: colors.purpleLight,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // File card
  fileCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileIconText: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileDetails: {
    color: colors.textMuted,
    fontSize: 11,
  },
  fileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteButton: {
    backgroundColor: `${colors.error}22`,
    borderColor: `${colors.error}44`,
  },
  actionIcon: {
    fontSize: 16,
  },

  // Dialog
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000cc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  dialogTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  dialogInput: {
    backgroundColor: colors.input,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.input,
  },
  confirmButton: {
    backgroundColor: colors.purple,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
