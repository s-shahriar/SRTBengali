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
  Modal,
  Dimensions,
} from 'react-native';
import { colors } from '../styles/theme';
import {
  scanForSRTFiles,
  formatFileSize,
  formatDate,
  SRTFileInfo,
} from '../utils/fileScanner';
import { renameFile, deleteFile } from '../utils/fileManager';
import { readFile } from '../utils/fileOperations';
import {
  hasDirectoryAccess,
  requestDirectoryAccess,
  clearSavedDirectoryUri,
  getSavedDirectoryUri,
} from '../utils/permissions';

interface RenameDialogState {
  visible: boolean;
  file: SRTFileInfo | null;
  newName: string;
}

interface ViewerState {
  visible: boolean;
  file: SRTFileInfo | null;
  content: string;
  loading: boolean;
}

export function FileBrowser() {
  const [files, setFiles] = useState<SRTFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [renameDialog, setRenameDialog] = useState<RenameDialogState>({
    visible: false,
    file: null,
    newName: '',
  });
  const [viewer, setViewer] = useState<ViewerState>({
    visible: false,
    file: null,
    content: '',
    loading: false,
  });

  const checkAccess = async () => {
    const access = await hasDirectoryAccess();
    setHasAccess(access);
    if (access) {
      const uri = await getSavedDirectoryUri();
      if (uri) {
        const decoded = decodeURIComponent(uri);
        const lastColon = decoded.lastIndexOf(':');
        setFolderName(lastColon >= 0 ? decoded.substring(lastColon + 1) || 'Root' : 'Selected folder');
      }
    }
    return access;
  };

  const loadFiles = async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      await checkAccess();
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

  const handleGrantAccess = async () => {
    const uri = await requestDirectoryAccess();
    if (uri) {
      setHasAccess(true);
      loadFiles();
    } else {
      Alert.alert(
        'Access Denied',
        'You need to grant folder access to scan for subtitle files.'
      );
    }
  };

  const handleChangeFolder = async () => {
    Alert.alert(
      'Change Folder',
      'Pick a new folder to scan for subtitles?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            await clearSavedDirectoryUri();
            const uri = await requestDirectoryAccess();
            if (uri) {
              loadFiles();
            } else {
              await checkAccess();
            }
          },
        },
      ]
    );
  };

  const handleViewFile = async (file: SRTFileInfo) => {
    setViewer({ visible: true, file, content: '', loading: true });
    try {
      const content = await readFile(file.uri);
      setViewer(prev => ({ ...prev, content, loading: false }));
    } catch (error: any) {
      setViewer(prev => ({
        ...prev,
        content: `Error reading file: ${error.message}`,
        loading: false,
      }));
    }
  };

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
    setRenameDialog({ visible: true, file, newName: file.name });
  };

  const handleRenameConfirm = async () => {
    const { file, newName } = renameDialog;
    if (!file || !newName.trim()) return;

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

  // No directory access granted yet
  if (!hasAccess && Platform.OS === 'android') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.centerContainer}
      >
        <Text style={styles.emptyIcon}>📁</Text>
        <Text style={styles.emptyText}>Folder Access Required</Text>
        <Text style={styles.emptyHint}>
          Grant access to a folder so the app can find and manage your subtitle files.
        </Text>
        <TouchableOpacity style={styles.grantButton} onPress={handleGrantAccess}>
          <Text style={styles.grantButtonText}>Select Folder</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (files.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.centerContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadFiles(true)} tintColor={colors.purple} />
        }
      >
        <Text style={styles.emptyIcon}>📂</Text>
        <Text style={styles.emptyText}>No subtitle files found</Text>
        <Text style={styles.emptyHint}>
          {hasAccess ? `No .srt, .ass, or .vtt files in "${folderName}"` : 'Processed files will appear here'}
        </Text>
        <View style={styles.emptyActions}>
          <TouchableOpacity style={styles.refreshButton} onPress={() => loadFiles(true)}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
          {hasAccess && Platform.OS === 'android' && (
            <TouchableOpacity style={[styles.refreshButton, styles.changeFolderButton]} onPress={handleChangeFolder}>
              <Text style={styles.refreshButtonText}>Change Folder</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadFiles(true)} tintColor={colors.purple} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerText}>
              {files.length} file{files.length !== 1 ? 's' : ''} found
            </Text>
            {hasAccess && Platform.OS === 'android' && (
              <TouchableOpacity onPress={handleChangeFolder}>
                <Text style={styles.changeFolderLink}>Change folder</Text>
              </TouchableOpacity>
            )}
          </View>
          {folderName && <Text style={styles.folderHint}>Scanning: {folderName}</Text>}
        </View>

        {files.map((file) => (
          <TouchableOpacity key={file.uri} style={styles.fileCard} onPress={() => handleViewFile(file)} activeOpacity={0.7}>
            <View style={styles.fileIcon}>
              <Text style={styles.fileIconText}>
                {file.name.endsWith('.ass') ? '📜' : file.name.endsWith('.vtt') ? '🎬' : '📝'}
              </Text>
            </View>

            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
              <Text style={styles.fileDetails}>
                {file.size > 0 ? formatFileSize(file.size) : ''}{file.size > 0 && file.modificationTime > 0 ? ' · ' : ''}{file.modificationTime > 0 ? formatDate(file.modificationTime) : ''}
              </Text>
            </View>

            <View style={styles.fileActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => handleRenamePress(file)}>
                <Text style={styles.actionIcon}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDelete(file)}>
                <Text style={styles.actionIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* File Viewer Modal */}
      <Modal
        visible={viewer.visible}
        animationType="slide"
        onRequestClose={() => setViewer(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <View style={styles.viewerTitleRow}>
              <Text style={styles.viewerTitle} numberOfLines={1}>
                {viewer.file?.name ?? ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewerCloseBtn}
              onPress={() => setViewer(prev => ({ ...prev, visible: false }))}
            >
              <Text style={styles.viewerCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          {viewer.loading ? (
            <View style={styles.viewerLoading}>
              <ActivityIndicator size="large" color={colors.purple} />
              <Text style={styles.loadingText}>Reading file...</Text>
            </View>
          ) : (
            <ScrollView style={styles.viewerScroll} contentContainerStyle={styles.viewerContent}>
              <Text style={styles.viewerText} selectable>{viewer.content}</Text>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Rename Dialog */}
      {renameDialog.visible && (
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Rename File</Text>
            <TextInput
              style={styles.dialogInput}
              value={renameDialog.newName}
              onChangeText={text => setRenameDialog(prev => ({ ...prev, newName: text }))}
              placeholder="Enter new name"
              placeholderTextColor={colors.textMuted}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogButton, styles.cancelButton]}
                onPress={() => setRenameDialog({ visible: false, file: null, newName: '' })}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dialogButton, styles.confirmButton]} onPress={handleRenameConfirm}>
                <Text style={styles.confirmButtonText}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyHint: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  emptyActions: { flexDirection: 'row', gap: 12 },

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
  changeFolderButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  refreshButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Grant access
  grantButton: {
    backgroundColor: colors.purple,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: colors.purple,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  grantButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Header
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { color: colors.purpleLight, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  changeFolderLink: { color: colors.purple, fontSize: 12, fontWeight: '600' },
  folderHint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },

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
  fileIconText: { fontSize: 24 },
  fileInfo: { flex: 1, marginRight: 8 },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  fileDetails: { color: colors.textMuted, fontSize: 11 },
  fileActions: { flexDirection: 'row', gap: 8 },
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
  actionIcon: { fontSize: 16 },

  // Viewer modal
  viewerContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 44 : 56,
    paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  viewerTitleRow: {
    flex: 1,
    marginRight: 12,
  },
  viewerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  viewerCloseBtn: {
    backgroundColor: colors.purple,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  viewerCloseBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerScroll: {
    flex: 1,
  },
  viewerContent: {
    padding: 16,
    paddingBottom: 60,
  },
  viewerText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
    lineHeight: 20,
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
  dialogTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
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
  dialogButtons: { flexDirection: 'row', gap: 12 },
  dialogButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: colors.input },
  confirmButton: { backgroundColor: colors.purple },
  cancelButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  confirmButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
