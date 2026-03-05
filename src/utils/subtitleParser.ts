import { SubBlock, SubFormat } from '../types';

/**
 * Detects subtitle format based on file extension
 */
export function detectFormat(filename: string): SubFormat {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'ass' || ext === 'ssa') return 'ass';
  if (ext === 'vtt') return 'vtt';
  return 'srt';
}

/**
 * Generates output filename by inserting _translated before extension
 */
export function makeOutputName(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0
    ? filename.slice(0, dot) + '_translated' + filename.slice(dot)
    : filename + '_translated';
}

/**
 * Parses SRT subtitle format
 */
function parseSrt(content: string): SubBlock[] {
  const blocks: SubBlock[] = [];
  for (const raw of content.trim().split(/\n\s*\n/)) {
    const lines = raw.trim().split('\n');
    if (lines.length < 3) continue;

    const index = lines[0].trim();
    const timing = lines[1].trim();
    const text = lines.slice(2).join('\n').trim();

    if (timing.includes('-->') && /^\d+$/.test(index)) {
      blocks.push({ index, timing, text });
    }
  }
  return blocks;
}

/**
 * Parses VTT subtitle format
 */
function parseVtt(content: string): SubBlock[] {
  const blocks: SubBlock[] = [];
  const body = content.replace(/^WEBVTT[^\n]*\n/, '').trim();
  let autoIdx = 1;

  for (const raw of body.split(/\n\s*\n/)) {
    const lines = raw.trim().split('\n').filter(l => l.trim());
    if (!lines.length) continue;

    const timingIdx = lines.findIndex(l => l.includes('-->'));
    if (timingIdx < 0) continue;

    const index = timingIdx > 0 ? lines[0].trim() : String(autoIdx++);
    const timing = lines[timingIdx].trim();
    const text = lines.slice(timingIdx + 1).join('\n').trim();

    if (text) blocks.push({ index, timing, text });
  }
  return blocks;
}

/**
 * Parses ASS subtitle format — extracts only Dialogue lines
 */
function parseAss(content: string): SubBlock[] {
  const blocks: SubBlock[] = [];
  let idx = 1;

  for (const line of content.split('\n')) {
    if (!line.startsWith('Dialogue:')) continue;

    // ASS: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
    const parts = line.split(',', 10); // limit 10 splits → [0..8] + rest as text
    if (parts.length < 10) continue;

    // Rejoin everything from index 9 onward (text can contain commas)
    const prefix = parts.slice(0, 9).join(',');
    const text = line.slice(prefix.length + 1); // +1 for the comma separator

    blocks.push({
      index: String(idx++),
      timing: `${parts[1].trim()} --> ${parts[2].trim()}`,
      text,
      rawPrefix: prefix,
      origText: text,
    });
  }
  return blocks;
}

/**
 * Parses subtitle content based on format
 */
export function parse(content: string, format: SubFormat): SubBlock[] {
  if (format === 'ass') return parseAss(content);
  if (format === 'vtt') return parseVtt(content);
  return parseSrt(content);
}

/**
 * Builds SRT subtitle format from blocks
 */
function buildSrt(blocks: SubBlock[]): string {
  return blocks
    .map(b => `${b.index}\n${b.timing}\n${b.text}`)
    .join('\n\n');
}

/**
 * Builds VTT subtitle format from blocks
 */
function buildVtt(blocks: SubBlock[]): string {
  return 'WEBVTT\n' + blocks
    .map(b => `\n${b.index}\n${b.timing}\n${b.text}`)
    .join('\n');
}

/**
 * Builds ASS subtitle format from blocks — replaces only changed dialogue lines
 */
function buildAss(blocks: SubBlock[], originalContent: string): string {
  let result = originalContent;

  for (const block of blocks) {
    if (
      block.rawPrefix !== undefined &&
      block.origText !== undefined &&
      block.text !== block.origText
    ) {
      const oldLine = `${block.rawPrefix},${block.origText}`;
      const newLine = `${block.rawPrefix},${block.text}`;
      result = result.replace(oldLine, newLine);
    }
  }
  return result;
}

/**
 * Builds subtitle content based on format
 */
export function buildSubtitle(
  blocks: SubBlock[],
  format: SubFormat,
  originalContent: string
): string {
  if (format === 'ass') return buildAss(blocks, originalContent);
  if (format === 'vtt') return buildVtt(blocks);
  return buildSrt(blocks);
}
