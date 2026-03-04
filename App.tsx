import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Modal,
  StatusBar, Platform, KeyboardAvoidingView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// ─────────────────────────────────────────────────────────────────────────────
// Cross-platform file helpers (web + native)
// ─────────────────────────────────────────────────────────────────────────────

async function readFile(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // On web, expo-document-picker returns a blob:// URL — fetch works fine
    const resp = await fetch(uri);
    return resp.text();
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

async function saveFile(filename: string, content: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Trigger a browser download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    // Native: write to cache directory then open share sheet
    const outputUri = (FileSystem.cacheDirectory ?? '') + filename;
    await FileSystem.writeAsStringAsync(outputUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(outputUri, {
      mimeType:    'text/plain',
      dialogTitle: `Save ${filename}`,
      UTI:         'public.plain-text',
    });
  }
}
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SubBlock {
  index: string;
  timing: string;
  text: string;
  // ASS only
  rawPrefix?: string;
  origText?: string;
}

interface GeminiModel {
  id: string;
  label: string;
  info: string;
  rpm: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 200;

const MODELS: GeminiModel[] = [
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    info: 'Preview: best balance of quality and vocabulary coverage',
    rpm: 10,
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    info: 'Free: 10 req/min · 250/day  — Great quality + speed',
    rpm: 10,
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite Preview',
    info: 'Preview: most cost-efficient, high-volume processing',
    rpm: 15,
  },
  {
    id: 'gemini-3-pro-preview',
    label: 'Gemini 3 Pro Preview',
    info: 'Preview: advanced reasoning + multimodal — highest quality',
    rpm: 5,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Subtitle helpers
// ─────────────────────────────────────────────────────────────────────────────

type SubFormat = 'srt' | 'ass' | 'vtt';

function detectFormat(filename: string): SubFormat {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'ass' || ext === 'ssa') return 'ass';
  if (ext === 'vtt') return 'vtt';
  return 'srt';
}

function makeOutputName(filename: string): string {
  // Insert _translated before the last extension only
  const dot = filename.lastIndexOf('.');
  return dot >= 0
    ? filename.slice(0, dot) + '_translated' + filename.slice(dot)
    : filename + '_translated';
}

// SRT parser
function parseSrt(content: string): SubBlock[] {
  const blocks: SubBlock[] = [];
  for (const raw of content.trim().split(/\n\s*\n/)) {
    const lines = raw.trim().split('\n');
    if (lines.length < 3) continue;
    const index  = lines[0].trim();
    const timing = lines[1].trim();
    const text   = lines.slice(2).join('\n').trim();
    if (timing.includes('-->') && /^\d+$/.test(index)) {
      blocks.push({ index, timing, text });
    }
  }
  return blocks;
}

// VTT parser
function parseVtt(content: string): SubBlock[] {
  const blocks: SubBlock[] = [];
  const body = content.replace(/^WEBVTT[^\n]*\n/, '').trim();
  let autoIdx = 1;
  for (const raw of body.split(/\n\s*\n/)) {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (!lines.length) continue;
    const timingIdx = lines.findIndex(l => l.includes('-->'));
    if (timingIdx < 0) continue;
    const index  = timingIdx > 0 ? lines[0].trim() : String(autoIdx++);
    const timing = lines[timingIdx].trim();
    const text   = lines.slice(timingIdx + 1).join('\n').trim();
    if (text) blocks.push({ index, timing, text });
  }
  return blocks;
}

// ASS parser — extracts only Dialogue lines
function parseAss(content: string): SubBlock[] {
  const blocks: SubBlock[] = [];
  let idx = 1;
  for (const line of content.split('\n')) {
    if (!line.startsWith('Dialogue:')) continue;
    const parts = line.split(',', 10);   // limit 10 splits → [0..8] + rest as text
    // ASS: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
    if (parts.length < 10) continue;
    // Rejoin everything from index 9 onward (text can contain commas)
    const prefix = parts.slice(0, 9).join(',');
    const text   = line.slice(prefix.length + 1); // +1 for the comma separator
    blocks.push({
      index:     String(idx++),
      timing:    `${parts[1].trim()} --> ${parts[2].trim()}`,
      text,
      rawPrefix: prefix,
      origText:  text,
    });
  }
  return blocks;
}

function parse(content: string, format: SubFormat): SubBlock[] {
  if (format === 'ass') return parseAss(content);
  if (format === 'vtt') return parseVtt(content);
  return parseSrt(content);
}

// Builders
function buildSrt(blocks: SubBlock[]): string {
  return blocks
    .map(b => `${b.index}\n${b.timing}\n${b.text}`)
    .join('\n\n');
}

function buildVtt(blocks: SubBlock[]): string {
  return 'WEBVTT\n' + blocks
    .map(b => `\n${b.index}\n${b.timing}\n${b.text}`)
    .join('\n');
}

function buildAss(blocks: SubBlock[], originalContent: string): string {
  // Replace only changed dialogue lines in the original content
  let result = originalContent;
  for (const block of blocks) {
    if (block.rawPrefix !== undefined && block.origText !== undefined && block.text !== block.origText) {
      const oldLine = `${block.rawPrefix},${block.origText}`;
      const newLine = `${block.rawPrefix},${block.text}`;
      result = result.replace(oldLine, newLine);
    }
  }
  return result;
}

function buildSubtitle(blocks: SubBlock[], format: SubFormat, originalContent: string): string {
  if (format === 'ass') return buildAss(blocks, originalContent);
  if (format === 'vtt') return buildVtt(blocks);
  return buildSrt(blocks);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini API
// ─────────────────────────────────────────────────────────────────────────────

async function annotateBatch(
  apiKey: string,
  modelId: string,
  texts: string[],
): Promise<string[]> {
  const n         = texts.length;
  const inputJson = JSON.stringify(texts);

  const prompt =
`You are helping a Bengali speaker learn English through movie subtitles.

TASK: Return the same ${n} subtitle lines with Bengali translations added after uncommon English words.

════════════════════════════════════════
⚠ ABSOLUTE RULES — NEVER BREAK THESE:
════════════════════════════════════════
1. Return EXACTLY ${n} items in the JSON array — one per input line. No more, no fewer.
2. Do NOT split, merge, or reorder subtitle lines.
3. Do NOT add or remove newline characters (\\n) inside any subtitle line.
4. Do NOT change punctuation, spacing, capitalization, or any existing text.
5. Preserve ALL formatting tags exactly as they appear: <i>, </i>, <b>, </b>, {\\i1}, {\\i0}, etc.
6. If a line has no uncommon words → return it COMPLETELY UNCHANGED.

════════════════════════════════════════
ANNOTATION RULES:
════════════════════════════════════════
- Format: word (বাংলা অর্থ)  — placed immediately after the English word
- Only annotate B2–C1 level vocabulary: words a Bengali adult with 2–3 years of English would NOT know
- SKIP common everyday words — including but not limited to: is, was, the, have, go, come, get, make, said, good, bad, want, know, like, see, look, feel, tell, need, just, very, also, then, when, that, this, with, from, they, what, who, beautiful, truth, guest, believe, appear, serious, possible, ordinary, youth, identify, report, searching, yet, seems, kindly, reality, simple, bigger, challenging, total, correct, perfect, special, normal, allow, agree, admit, accept, avoid, begin, call, carry, catch, cause, choose, consider, continue, create, decide, depend, describe, discover, dream, enjoy, exist, expect, explain, fail, fall, follow, forget, happen, help, hope, imagine, include, involve, keep, lead, learn, leave, let, lose, love, manage, miss, move, offer, open, pay, play, prepare, prevent, produce, prove, provide, reach, realize, receive, remain, remember, remove, require, result, return, run, seem, send, set, show, sit, spend, stand, start, stay, stop, support, suppose, suggest, turn, understand, use, wait, win, wish, work, write, etc.
- ONLY annotate words like: perpetrator, clasp, nuance, flaunting, hesitation, rarity, coax, smudge, ploy, endured, obstinate, treacherous, mangled, desperation, compensation, deteriorate, surveillance, concealed, retaliate, extortion, etc.
- Use sentence context for the correct Bengali meaning — "bank" near "river" = নদীর তীর, not ব্যাংক
- Keep Bengali translation short: 1–3 Bengali words max
- Annotate each word only on its first occurrence per line
- PHRASAL VERBS (rule out, give up, hold on, look into, etc.): place the annotation AFTER the COMPLETE phrasal verb, never in the middle. Example — WRONG: "rule out (বাদ দেওয়া) it out" / CORRECT: "rule it out (বাদ দেওয়া)" — or skip the phrasal verb entirely if unsure.

EXAMPLE:
Input:  ["She was obstinate about leaving.", "Hello, how are you?", "The river bank was steep and treacherous."]
Output: ["She was obstinate (একগুঁয়ে) about leaving.", "Hello, how are you?", "The river bank (নদীর তীর) was steep and treacherous (বিপজ্জনক)."]

INPUT (${n} subtitle lines as JSON array):
${inputJson}

Respond with ONLY the JSON array. No explanation. No markdown code fences.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  const data = await response.json();

  if (data.error) {
    if (data.error.code === 429) {
      // Parse the exact wait time the API specifies
      let retryAfterMs = 30_000;
      const retryInfo = (data.error.details ?? []).find(
        (d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo',
      );
      if (retryInfo?.retryDelay) {
        const secs = parseFloat(String(retryInfo.retryDelay).replace('s', ''));
        if (!isNaN(secs)) retryAfterMs = Math.ceil(secs * 1000) + 2_000; // +2s buffer
      }
      throw new RateLimitError(data.error.message ?? 'Rate limited', retryAfterMs);
    }
    throw new Error(data.error.message ?? 'Gemini API error');
  }

  const responseText: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  // Extract the JSON array from the response
  const match = responseText.match(/\[[\s\S]*\]/);
  if (!match) return texts;

  const result: string[] = JSON.parse(match[0]);

  // Safety: only accept if count matches exactly
  if (result.length !== n) return texts;

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [apiKey,       setApiKey]       = useState('');
  const [keySaved,     setKeySaved]     = useState(false);
  const [model,        setModel]        = useState<GeminiModel>(MODELS[0]);
  const [modelModal,   setModelModal]   = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string } | null>(null);
  const [processing,   setProcessing]   = useState(false);
  const [statusMsg,    setStatusMsg]    = useState('');
  const [log,          setLog]          = useState('');
  const logRef = useRef<ScrollView>(null);

  // Restore saved preferences
  useEffect(() => {
    AsyncStorage.getItem('api_key').then(k => { if (k) setApiKey(k); });
    AsyncStorage.getItem('model_id').then(id => {
      if (id) {
        const m = MODELS.find(m => m.id === id);
        if (m) setModel(m);
      }
    });
  }, []);

  const appendLog = (msg: string) => {
    setLog(prev => prev + msg + '\n');
    setTimeout(() => logRef.current?.scrollToEnd({ animated: false }), 80);
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSaveKey = async () => {
    const key = apiKey.trim();
    if (!key) { Alert.alert('Empty', 'API key cannot be empty.'); return; }
    await AsyncStorage.setItem('api_key', key);
    setKeySaved(true);
  };

  const handlePickModel = (m: GeminiModel) => {
    setModel(m);
    AsyncStorage.setItem('model_id', m.id);
    setModelModal(false);
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type:                 '*/*',
      copyToCacheDirectory: true,   // copies to a readable path on Android
    });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];
    setSelectedFile({ name: file.name, uri: file.uri });
    setLog('');
    appendLog(`Selected : ${file.name}`);
    appendLog(`Format   : ${detectFormat(file.name).toUpperCase()}`);
    appendLog(`Output   : ${makeOutputName(file.name)}\n`);
  };

  const handleProcess = async () => {
    const key = apiKey.trim();
    if (!key)          { Alert.alert('Missing', 'Enter and save your Gemini API key first.'); return; }
    if (!selectedFile) { Alert.alert('Missing', 'Select a subtitle file first.'); return; }

    setProcessing(true);
    setLog('');

    try {
      const { name, uri } = selectedFile;
      const format        = detectFormat(name);

      // Read file (works on both web and native)
      setStatusMsg('Reading file…');
      const content = await readFile(uri);

      const blocks  = parse(content, format);
      const batches = chunk(blocks, BATCH_SIZE);
      const delayMs = Math.ceil(60_000 / model.rpm) + 500;

      appendLog(`Model    : ${model.label}`);
      appendLog(`Blocks   : ${blocks.length} subtitle lines`);
      appendLog(`Batches  : ${batches.length} × up to ${BATCH_SIZE} lines`);
      appendLog(`Delay    : ${delayMs}ms between calls (${model.rpm} RPM)\n`);

      // Process batches
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        // Retry loop — handles rate-limit 429 errors with backoff
        let annotated: string[] = batch.map(b => b.text);
        const maxRetries = 3;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          setStatusMsg(`Batch ${i + 1} / ${batches.length}  (${model.label})`);
          try {
            annotated = await annotateBatch(key, model.id, batch.map(b => b.text));
            break; // success — exit retry loop
          } catch (err: any) {
            if (err instanceof RateLimitError && attempt < maxRetries) {
              const waitSec = Math.ceil(err.retryAfterMs / 1000);
              appendLog(`[Batch ${i + 1}] Rate limited — API says wait ${waitSec}s (retry ${attempt + 1}/${maxRetries})`);
              await sleepWithCountdown(err.retryAfterMs, (remaining) => {
                setStatusMsg(`Rate limited — retrying in ${remaining}s…`);
              });
            } else {
              appendLog(`[Batch ${i + 1}] Error: ${err.message} — skipped`);
              break; // keep originals
            }
          }
        }

        // Write annotated text back — timing and index are never modified
        annotated.forEach((newText, j) => {
          if (newText && newText.trim() && newText !== batch[j].text) {
            batch[j].text = newText;
            appendLog(`[${batch[j].index}] ${newText.slice(0, 80)}`);
          }
        });

        // Rate limiting — skip delay after last batch
        if (i < batches.length - 1) {
          await sleep(delayMs);
        }
      }

      // Build output and save (web = browser download, native = share sheet)
      setStatusMsg('Saving…');
      const outputContent  = buildSubtitle(blocks, format, content);
      const outputFilename = makeOutputName(name);

      appendLog(`\nDone! Saving ${outputFilename}…`);
      setStatusMsg('');

      await saveFile(outputFilename, outputContent);

    } catch (err: any) {
      appendLog(`\nFatal error: ${err.message}`);
      Alert.alert('Error', err.message);
    } finally {
      setProcessing(false);
      setStatusMsg('');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

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

        {/* ── Step 1: API Key ── */}
        <StepHeader number="1" title="GEMINI API KEY" />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={apiKey}
            onChangeText={t => { setApiKey(t); setKeySaved(false); }}
            secureTextEntry
            placeholder="Paste your Gemini API key"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.saveBtn, keySaved && styles.saveBtnDone]}
            onPress={handleSaveKey}
          >
            <Text style={styles.saveBtnText}>{keySaved ? '✓ Saved' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Get a free key at aistudio.google.com → Get API key
        </Text>

        {/* ── Step 2: Model ── */}
        <StepHeader number="2" title="GEMINI MODEL" />
        <TouchableOpacity
          style={styles.modelBtn}
          onPress={() => setModelModal(true)}
          disabled={processing}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.modelBtnText}>{model.label}</Text>
            <Text style={styles.modelBtnInfo}>{model.info}</Text>
          </View>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>

        {/* ── Step 3: File ── */}
        <StepHeader number="3" title="SUBTITLE FILE" />
        <TouchableOpacity
          style={[styles.fileBtn, processing && styles.disabled]}
          onPress={handlePickFile}
          disabled={processing}
        >
          <Text style={styles.fileIcon}>{selectedFile ? '📄' : '📂'}</Text>
          <Text style={styles.fileBtnMain}>
            {selectedFile ? selectedFile.name : 'Tap to select file'}
          </Text>
          {!selectedFile && (
            <Text style={styles.fileBtnFormats}>.srt  ·  .ass  ·  .vtt</Text>
          )}
        </TouchableOpacity>

        {selectedFile && (
          <View style={styles.fileInfo}>
            <View style={styles.fileInfoRow}>
              <Text style={styles.fileInfoArrow}>↑</Text>
              <Text style={styles.fileInfoValue} numberOfLines={1}>{selectedFile.name}</Text>
            </View>
            <View style={[styles.fileInfoRow, { marginTop: 6 }]}>
              <Text style={[styles.fileInfoArrow, { color: C.green }]}>↓</Text>
              <Text style={[styles.fileInfoValue, { color: C.green }]} numberOfLines={1}>
                {makeOutputName(selectedFile.name)}
              </Text>
            </View>
          </View>
        )}

        {/* ── Process ── */}
        <TouchableOpacity
          style={[styles.processBtn, (!selectedFile || !apiKey.trim()) && styles.processBtnDim, processing && styles.processBtnBusy]}
          onPress={handleProcess}
          disabled={processing}
        >
          {processing ? (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.processBtnText}>{statusMsg || 'Processing…'}</Text>
            </View>
          ) : (
            <Text style={styles.processBtnText}>Add Bengali Translations  →</Text>
          )}
        </TouchableOpacity>

        {/* ── Log ── */}
        {log.length > 0 && (
          <View style={styles.logCard}>
            <Text style={styles.logHeader}>LOG</Text>
            <ScrollView ref={logRef} style={styles.log} nestedScrollEnabled>
              <Text style={styles.logText}>{log}</Text>
            </ScrollView>
          </View>
        )}

      </ScrollView>

      {/* ── Model picker modal ── */}
      <Modal
        visible={modelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setModelModal(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModelModal(false)}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Model</Text>
            {MODELS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelOption, m.id === model.id && styles.modelOptionActive]}
                onPress={() => handlePickModel(m)}
              >
                <View style={styles.modelOptionHeader}>
                  <Text style={[styles.modelOptionLabel, m.id === model.id && { color: C.purple }]}>
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
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helper components
// ─────────────────────────────────────────────────────────────────────────────

function StepHeader({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNum}>{number}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

// Sleeps for `ms` milliseconds, calling onTick(remainingSeconds) every second
function sleepWithCountdown(ms: number, onTick: (remaining: number) => void) {
  return new Promise<void>(resolve => {
    const end = Date.now() + ms;
    const tick = () => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      if (remaining <= 0) { onTick(0); resolve(); }
      else { onTick(remaining); setTimeout(tick, 1000); }
    };
    tick();
  });
}

class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:     '#1a1a35',
  card:   '#242450',
  input:  '#1e1e42',
  purple: '#8b7fff',
  purpleDim: '#5a4fd0',
  green:  '#4ade80',
  muted:  '#6a6a95',
  text:   '#eaeaf8',
  sub:    '#9090bb',
};

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.bg },

  // Header
  header:          { backgroundColor: C.card, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#ffffff0d', alignItems: 'center' },
  headerRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  headerTitle:     { color: C.purple, fontSize: 26, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center' },
  headerBadge:     { backgroundColor: '#8b7fff22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#8b7fff44' },
  headerBadgeText: { color: C.purple, fontSize: 13, fontWeight: '600' },
  headerSub:       { color: C.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },

  scroll:          { flex: 1 },
  scrollContent:   { padding: 16, paddingBottom: 50 },

  // Step headers
  stepHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 10 },
  stepBadge:       { width: 24, height: 24, borderRadius: 12, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  stepNum:         { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepTitle:       { color: C.sub, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  hint:            { color: C.muted, fontSize: 11, marginTop: 8, lineHeight: 16 },
  row:             { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // API key
  input:           {
    backgroundColor: C.input,
    color: C.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 13,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
    borderWidth: 1,
    borderColor: '#ffffff12',
  },
  saveBtn:         { backgroundColor: C.purple, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, minWidth: 80, alignItems: 'center' },
  saveBtnDone:     { backgroundColor: '#2a6b3f' },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Model picker
  modelBtn:        { backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ffffff0d', gap: 10 },
  modelBtnText:    { color: C.text, fontSize: 14, fontWeight: '600' },
  modelBtnInfo:    { color: C.muted, fontSize: 11, marginTop: 3 },
  chevron:         { color: C.purple, fontSize: 20 },

  // File picker
  fileBtn:         { borderRadius: 12, borderWidth: 1.5, borderColor: '#7c6fff55', borderStyle: 'dashed', paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', gap: 6 },
  fileIcon:        { fontSize: 32 },
  fileBtnMain:     { color: C.text, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  fileBtnFormats:  { color: C.muted, fontSize: 12, marginTop: 2 },

  fileInfo:        { backgroundColor: C.card, borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#ffffff0d' },
  fileInfoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileInfoArrow:   { color: C.muted, fontSize: 16, fontWeight: '700', width: 16 },
  fileInfoValue:   { color: C.sub, fontSize: 12, flex: 1 },

  // Process button
  processBtn:      { backgroundColor: C.purple, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 28, shadowColor: C.purple, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  processBtnBusy:  { backgroundColor: C.purpleDim },
  processBtnDim:   { opacity: 0.5 },
  processBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // Log
  logCard:         { marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: '#ffffff0d', overflow: 'hidden' },
  logHeader:       { backgroundColor: C.card, color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 14, paddingVertical: 8 },
  log:             { backgroundColor: '#07071a', maxHeight: 260, padding: 12 },
  logText:         { color: C.green, fontSize: 11, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New', lineHeight: 20 },

  disabled:        { opacity: 0.4 },

  // Modal
  overlay:         { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  sheetTitle:      { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 18 },
  modelOption:     { backgroundColor: C.input, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#ffffff0d' },
  modelOptionActive:  { borderColor: C.purple, borderWidth: 1.5 },
  modelOptionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  modelOptionLabel:   { color: C.text, fontSize: 14, fontWeight: '600' },
  modelOptionInfo:    { color: C.muted, fontSize: 11, lineHeight: 16 },
  bestBadge:          { backgroundColor: '#8b7fff33', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#8b7fff55' },
  bestBadgeText:      { color: C.purple, fontSize: 10, fontWeight: '700' },
});
