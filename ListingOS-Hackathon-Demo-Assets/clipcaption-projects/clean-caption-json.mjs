#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error('Usage: node clean-caption-json.mjs input.json output.json');
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const stripNonSpeechCue = (text) =>
  String(text ?? '')
    .replace(/\s*\[(?:music|applause|laughter|noise)[^\]]*(?:\]|$)/gi, '')
    .replace(/\s*playing\]\s*$/i, '')
    .trim();

const captions = (source.captions ?? [])
  .map((caption) => ({...caption, text: stripNonSpeechCue(caption.text)}))
  .filter((caption) => caption.text.length > 0);

const transcription = source.transcription
  ? {
      ...source.transcription,
      text: source.transcription.text
        ?.replace(/\s*\[(?:MUSIC|APPLAUSE|LAUGHTER|NOISE)[^\]]*\]\s*$/i, '')
        .trim(),
      words: (source.transcription.words ?? [])
        .map((word) => ({...word, word: stripNonSpeechCue(word.word ?? word.text ?? '')}))
        .filter((word) => word.word.length > 0),
    }
  : source.transcription;

const cleaned = {
  ...source,
  captions,
  transcription,
};

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${JSON.stringify(cleaned, null, 2)}\n`);
console.log(`Wrote ${captions.length} speech caption tokens to ${outputPath}`);
