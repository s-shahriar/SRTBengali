import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import { GeminiModel, SelectedFile, RateLimitError } from '../types';
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

export function useSubtitleProcessor({
  apiKey,
  model,
  selectedFile,
  onLog,
}: UseSubtitleProcessorParams) {
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

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
              onLog(
                `[Batch ${i + 1}] Rate limited — API says wait ${waitSec}s (retry ${attempt + 1}/${maxRetries})`
              );
              await sleepWithCountdown(err.retryAfterMs, remaining => {
                setStatusMsg(`Rate limited — retrying in ${remaining}s…`);
              });
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
            onLog(`[${batch[j].index}] ${newText.slice(0, 80)}`);
          }
        });

        // Rate limiting — skip delay after last batch
        if (i < batches.length - 1) {
          await sleep(delayMs);
        }
      }

      // Build output and save
      setStatusMsg('Saving…');
      const outputContent = buildSubtitle(blocks, format, content);
      const outputFilename = makeOutputName(name);

      onLog(`\nDone! Saving ${outputFilename}…`);
      setStatusMsg('');

      // Pass the source URI so the file can be saved in the same directory
      await saveFile(outputFilename, outputContent, uri);
    } catch (err: any) {
      onLog(`\nFatal error: ${err.message}`);
      Alert.alert('Error', err.message);
    } finally {
      setProcessing(false);
      setStatusMsg('');
    }
  };

  return {
    processing,
    statusMsg,
    processSubtitle,
  };
}
