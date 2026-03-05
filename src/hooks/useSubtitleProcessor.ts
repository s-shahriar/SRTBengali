import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import { GeminiModel, SelectedFile, RateLimitError, CountMismatchError, BatchStats } from '../types';
import { readFile, saveFile } from '../utils/fileOperations';
import { detectFormat, parse, buildSubtitle, makeOutputName } from '../utils/subtitleParser';
import { chunk, sleep, sleepWithCountdown } from '../utils/helpers';
import { annotateBatch } from '../services/geminiApi';
import { BATCH_SIZE } from '../constants/config';

interface UseSubtitleProcessorParams {
  apiKey: string;
  model: GeminiModel;
  selectedFile: SelectedFile | null;
  onLog: (message: string) => void;
}

function fmtTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function pct(part: number, total: number): string {
  return total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '—';
}

function printReport(
  stats: BatchStats[],
  totalElapsedMs: number,
  fileName: string,
  modelLabel: string,
  totalLines: number,
  onLog: (msg: string) => void,
) {
  const log = onLog;

  log('');
  log('═══════════════════════════════════════════');
  log('  TRANSLATION PERFORMANCE REPORT');
  log('═══════════════════════════════════════════');
  log(`  File       : ${fileName}`);
  log(`  Model      : ${modelLabel}`);
  log(`  Total lines: ${totalLines}`);
  log('');
  log('  ─── PER-BATCH BREAKDOWN ───────────────');
  log('  Batch │ Lines │ API Time │ RPM Wait │ 429 Wait │ Retries │ Changed │ Prompt Tk │ Resp Tk │ Cached Tk');
  log('  ──────┼───────┼──────────┼──────────┼──────────┼─────────┼─────────┼───────────┼─────────┼──────────');

  for (const s of stats) {
    const idx = String(s.batchIndex + 1).padStart(4);
    const lines = String(s.lineCount).padStart(5);
    const api = fmtTime(s.apiTimeMs).padStart(8);
    const rateDelay = fmtTime(s.rateDelayMs).padStart(8);
    const rlWait = fmtTime(s.rateLimitWaitMs).padStart(8);
    const retries = String(s.retryCount).padStart(7);
    const changed = String(s.linesChanged).padStart(7);
    const pTk = String(s.promptTokens).padStart(9);
    const rTk = String(s.responseTokens).padStart(7);
    const cTk = String(s.cachedTokens).padStart(9);
    log(`  ${idx}  │${lines} │${api} │${rateDelay} │${rlWait} │${retries} │${changed} │${pTk} │${rTk} │${cTk}`);
  }

  const totApiMs = stats.reduce((a, s) => a + s.apiTimeMs, 0);
  const totRateDelay = stats.reduce((a, s) => a + s.rateDelayMs, 0);
  const totRlWait = stats.reduce((a, s) => a + s.rateLimitWaitMs, 0);
  const totRetries = stats.reduce((a, s) => a + s.retryCount, 0);
  const totChanged = stats.reduce((a, s) => a + s.linesChanged, 0);
  const totPromptTk = stats.reduce((a, s) => a + s.promptTokens, 0);
  const totRespTk = stats.reduce((a, s) => a + s.responseTokens, 0);
  const totAllTk = stats.reduce((a, s) => a + s.totalTokens, 0);
  const totCachedTk = stats.reduce((a, s) => a + s.cachedTokens, 0);

  log('');
  log('  ─── CONSOLIDATED SUMMARY ──────────────');
  log(`  Total wall time  : ${fmtTime(totalElapsedMs)}`);
  log(`  ├─ API calls     : ${fmtTime(totApiMs)}  (${pct(totApiMs, totalElapsedMs)})`);
  log(`  ├─ RPM delays    : ${fmtTime(totRateDelay)}  (${pct(totRateDelay, totalElapsedMs)})`);
  log(`  └─ 429 wait      : ${fmtTime(totRlWait)}  (${pct(totRlWait, totalElapsedMs)})`);
  log('');
  log(`  Total tokens     : ${totAllTk.toLocaleString()}`);
  log(`  ├─ Prompt tokens : ${totPromptTk.toLocaleString()}${totCachedTk > 0 ? `  (cached: ${totCachedTk.toLocaleString()})` : ''}`);
  log(`  └─ Response tokens: ${totRespTk.toLocaleString()}`);
  log('');
  log(`  Lines changed    : ${totChanged} / ${totalLines}  (${pct(totChanged, totalLines)})`);
  log(`  Retries          : ${totRetries}`);
  log(`  Avg API time     : ${fmtTime(Math.round(totApiMs / stats.length))} / batch`);
  log('═══════════════════════════════════════════');
}

export function useSubtitleProcessor({
  apiKey,
  model,
  selectedFile,
  onLog,
}: UseSubtitleProcessorParams) {
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const cancelProcessing = () => {
    abortRef.current?.abort();
  };

  const processSubtitle = async () => {
    const key = apiKey.trim();
    if (!key) {
      Alert.alert('Missing', 'Enter and save your Gemini API key first.');
      return;
    }
    if (!selectedFile) {
      Alert.alert('Missing', 'Select a subtitle file first.');
      return;
    }

    setProcessing(true);
    setStatusMsg('');
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    try {
      const { name, uri } = selectedFile;
      const format = detectFormat(name);

      // Read file
      setStatusMsg('Reading file…');
      const content = await readFile(uri);

      const blocks = parse(content, format);
      const batches = chunk(blocks, BATCH_SIZE);
      const delayMs = Math.ceil(60_000 / model.rpm) + 500;

      onLog(`Model    : ${model.label}`);
      onLog(`Blocks   : ${blocks.length} subtitle lines`);
      onLog(`Batches  : ${batches.length} × up to ${BATCH_SIZE} lines`);
      onLog(`Delay    : ${delayMs}ms between calls (${model.rpm} RPM)\n`);

      const allStats: BatchStats[] = [];
      const jobStartTime = Date.now();

      // Process batches
      for (let i = 0; i < batches.length; i++) {
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        const batch = batches[i];

        const stat: BatchStats = {
          batchIndex: i,
          lineCount: batch.length,
          apiTimeMs: 0,
          rateDelayMs: 0,
          rateLimitWaitMs: 0,
          retryCount: 0,
          linesChanged: 0,
          promptTokens: 0,
          responseTokens: 0,
          totalTokens: 0,
          cachedTokens: 0,
          success: false,
        };

        // Retry loop — handles rate-limit 429 errors with backoff
        let annotated: string[] = batch.map(b => b.text);
        const maxRetries = 3;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          setStatusMsg(`Batch ${i + 1} / ${batches.length}  (${model.label})`);
          try {
            const result = await annotateBatch(key, model.id, batch.map(b => b.text));
            annotated = result.texts;
            stat.apiTimeMs += result.apiTimeMs;
            stat.promptTokens = result.promptTokens;
            stat.responseTokens = result.responseTokens;
            stat.totalTokens = result.totalTokens;
            stat.cachedTokens = result.cachedTokens;
            stat.success = true;
            break; // success — exit retry loop
          } catch (err: any) {
            if (err instanceof RateLimitError && attempt < maxRetries) {
              stat.retryCount++;
              const waitSec = Math.ceil(err.retryAfterMs / 1000);
              onLog(
                `[Batch ${i + 1}] Rate limited — API says wait ${waitSec}s (retry ${attempt + 1}/${maxRetries})`
              );
              const rlStart = Date.now();
              await sleepWithCountdown(err.retryAfterMs, remaining => {
                setStatusMsg(`Rate limited — retrying in ${remaining}s…`);
              }, signal);
              stat.rateLimitWaitMs += Date.now() - rlStart;
            } else if (err instanceof CountMismatchError && attempt < maxRetries) {
              stat.retryCount++;
              onLog(
                `[Batch ${i + 1}] Count mismatch (got ${err.received}, expected ${err.expected}) — retry ${attempt + 1}/${maxRetries}`
              );
              setStatusMsg(`Count mismatch — retrying batch ${i + 1}…`);
            } else {
              onLog(`[Batch ${i + 1}] Error: ${err.message} — skipped`);
              break; // keep originals
            }
          }
        }

        // Write annotated text back — timing and index are never modified
        annotated.forEach((newText, j) => {
          if (newText && newText.trim() && newText !== batch[j].text) {
            batch[j].text = newText;
            stat.linesChanged++;
            onLog(`[${batch[j].index}] ${newText.slice(0, 80)}`);
          }
        });

        // Rate limiting — skip delay after last batch
        if (i < batches.length - 1) {
          const delayStart = Date.now();
          await sleep(delayMs, signal);
          stat.rateDelayMs = Date.now() - delayStart;
        }

        allStats.push(stat);
      }

      const totalElapsedMs = Date.now() - jobStartTime;

      // Build output and save
      setStatusMsg('Saving…');
      const outputContent = buildSubtitle(blocks, format, content);
      const outputFilename = makeOutputName(name);

      onLog(`\nDone! Saving ${outputFilename}…`);

      // Pass the source URI so the file can be saved in the same directory
      await saveFile(outputFilename, outputContent, uri);

      // Print consolidated performance report
      printReport(allStats, totalElapsedMs, name, model.label, blocks.length, onLog);

      setStatusMsg('');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        onLog('\n⛔ Cancelled by user.');
        setStatusMsg('');
      } else {
        onLog(`\nFatal error: ${err.message}`);
        Alert.alert('Error', err.message);
      }
    } finally {
      abortRef.current = null;
      setProcessing(false);
      setStatusMsg('');
    }
  };

  return {
    processing,
    statusMsg,
    processSubtitle,
    cancelProcessing,
  };
}
