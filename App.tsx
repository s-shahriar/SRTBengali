import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
import { GeminiModel, SelectedFile } from './src/types';

// Constants
import { MODELS, BATCH_SIZE, BATCH_SIZE_STORAGE_KEY } from './src/constants/config';

// Styles
import { colors } from './src/styles/theme';
import { styles } from './src/styles/AppStyles';

// Hooks
import { useApiKey } from './src/hooks/useApiKey';
import { useSubtitleProcessor } from './src/hooks/useSubtitleProcessor';

// Components
import { StepHeader } from './src/components/StepHeader';
import { ModelPicker } from './src/components/ModelPicker';
import { FileSelector } from './src/components/FileSelector';
import { ProcessingLog } from './src/components/ProcessingLog';
import { BatchSizePicker } from './src/components/BatchSizePicker';

// Utils
import { detectFormat, makeOutputName } from './src/utils/subtitleParser';
import { permissionHandler } from './src/utils/permissions';

const MODEL_ID_STORAGE_KEY = 'model_id';

export default function App() {
  // API Key management
  const { apiKey, keySaved, saveApiKey, updateApiKey } = useApiKey();

  // Model selection
  const [model, setModel] = useState<GeminiModel>(MODELS[0]);
  const [modelModalVisible, setModelModalVisible] = useState(false);

  // Batch size
  const [batchSize, setBatchSize] = useState<number>(BATCH_SIZE);
  const [batchSizeModalVisible, setBatchSizeModalVisible] = useState(false);

  // File selection
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  // Logging
  const [log, setLog] = useState('');

  // Request storage permissions on first boot & restore saved preferences
  useEffect(() => {
    permissionHandler.requestStoragePermission();

    AsyncStorage.getItem(MODEL_ID_STORAGE_KEY).then(id => {
      if (id) {
        const savedModel = MODELS.find(m => m.id === id);
        if (savedModel) setModel(savedModel);
      }
    });
    AsyncStorage.getItem(BATCH_SIZE_STORAGE_KEY).then(val => {
      if (val) {
        const size = parseInt(val, 10);
        if (!isNaN(size) && size > 0) setBatchSize(size);
      }
    });
  }, []);

  const appendLog = (msg: string) => {
    setLog(prev => prev + msg + '\n');
  };

  // Subtitle processor
  const { processing, statusMsg, processSubtitle, cancelProcessing } = useSubtitleProcessor({
    apiKey,
    model,
    selectedFile,
    onLog: appendLog,
    batchSize,
  });

  // Handlers
  const handleSelectModel = (m: GeminiModel) => {
    setModel(m);
    AsyncStorage.setItem(MODEL_ID_STORAGE_KEY, m.id);
    setModelModalVisible(false);
  };

  const handleSelectBatchSize = (size: number) => {
    setBatchSize(size);
    AsyncStorage.setItem(BATCH_SIZE_STORAGE_KEY, String(size));
    setBatchSizeModalVisible(false);
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const file = result.assets[0];
    setSelectedFile({ name: file.name, uri: file.uri });
    setLog('');
    appendLog(`Selected : ${file.name}`);
    appendLog(`Format   : ${detectFormat(file.name).toUpperCase()}`);
    appendLog(`Output   : ${makeOutputName(file.name)}\n`);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>SRT Bengali</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>বাংলা</Text>
          </View>
        </View>
        <Text style={styles.headerSub}>
          Adds Bengali hints for uncommon English words in subtitles
        </Text>
      </View>

      <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        {/* Step 1: API Key */}
        <StepHeader number="1" title="GEMINI API KEY" />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={apiKey}
            onChangeText={updateApiKey}
            secureTextEntry
            placeholder="Paste your Gemini API key"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.saveBtn, keySaved && styles.saveBtnDone]}
            onPress={saveApiKey}
          >
            <Text style={styles.saveBtnText}>
              {keySaved ? '✓ Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Get a free key at aistudio.google.com → Get API key
        </Text>

        {/* Step 2: Model */}
        <StepHeader number="2" title="GEMINI MODEL" />
        <ModelPicker
          selectedModel={model}
          visible={modelModalVisible}
          disabled={processing}
          onSelect={handleSelectModel}
          onClose={() => setModelModalVisible(false)}
          onOpen={() => setModelModalVisible(true)}
        />

        {/* Step 3: File */}
        <StepHeader number="3" title="SUBTITLE FILE" />
        <FileSelector
          selectedFile={selectedFile}
          disabled={processing}
          onPickFile={handlePickFile}
        />

        {/* Step 4: Batch Size */}
        <StepHeader number="4" title="BATCH SIZE" />
        <BatchSizePicker
          selectedSize={batchSize}
          visible={batchSizeModalVisible}
          disabled={processing}
          onSelect={handleSelectBatchSize}
          onClose={() => setBatchSizeModalVisible(false)}
          onOpen={() => setBatchSizeModalVisible(true)}
        />

        {/* Process Button */}
        <TouchableOpacity
          style={[
            styles.processBtn,
            (!selectedFile || !apiKey.trim()) && styles.processBtnDim,
            processing && styles.processBtnBusy,
          ]}
          onPress={processSubtitle}
          disabled={processing}
        >
          {processing ? (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.processBtnText}>
                {statusMsg || 'Processing…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.processBtnText}>
              Add Bengali Translations  →
            </Text>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        {processing && (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelProcessing}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {/* Log */}
        <ProcessingLog log={log} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
