#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
const envText = await readFile('/Users/arnaud/.hermes/.env', 'utf-8');
const KEY = envText.match(/GEMINI_API_KEY=["']?([^"'\n]+)/)?.[1];
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}&pageSize=100`);
const data = await res.json();
if (data.models) {
  data.models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .forEach((m) => console.log(m.name.replace('models/', '')));
} else {
  console.log(JSON.stringify(data).slice(0, 500));
}
