import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const configPath = path.join(root, 'config', 'target-date.json');
const configRaw = await fs.readFile(configPath, 'utf8');
const config = JSON.parse(configRaw);

const targetDate = config.targetDate;
if (!targetDate || typeof targetDate !== 'string') {
  throw new Error('config/target-date.json must include a targetDate string');
}

const labelDate = targetDate.split('T')[0];
const timeMatch = targetDate.match(/T(\d{2}:\d{2})/);
const labelTime = timeMatch ? timeMatch[1] : '00:00';
const tzMatch = targetDate.match(/([+-]\d{2}):\d{2}$/);
const tzHours = tzMatch ? parseInt(tzMatch[1], 10) : 0;
const tzLabel = `UTC${tzHours >= 0 ? '+' : ''}${tzHours}`;

const targetDisplay = `${labelDate} ${labelTime} (${tzLabel})`;

const replacements = [
  {
    file: 'src/main.js',
    patterns: [
      {
        regex: /Target Date:\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/,
        replacement: `Target Date: ${targetDate}`,
      },
      {
        regex: /const TARGET_DATE = new Date\('[^']+'\);/,
        replacement: `const TARGET_DATE = new Date('${targetDate}');`,
      },
    ],
  },
  {
    file: 'index.html',
    patterns: [
      {
        regex: /Launching \d{4}-\d{2}-\d{2}\./,
        replacement: `Launching ${labelDate}.`,
      },
      {
        regex: /T-MINUS \/\/ TARGET \d{4}-\d{2}-\d{2}/,
        replacement: `T-MINUS // TARGET ${labelDate}`,
      },
    ],
  },
  {
    file: 'README.md',
    patterns: [
      {
        regex: /^\*\*Target Date:\*\* .*/m,
        replacement: `**Target Date:** ${targetDisplay}`,
      },
    ],
  },
  {
    file: 'countdown.svg',
    patterns: [
      {
        regex: /(T-MINUS \/\/ TARGET: )\d{4}-\d{2}-\d{2}/,
        replacement: `$1${labelDate}`,
      },
    ],
  },
];

for (const { file, patterns } of replacements) {
  const filePath = path.join(root, file);
  let content = await fs.readFile(filePath, 'utf8');
  let updated = content;

  for (const { regex, replacement } of patterns) {
    updated = updated.replace(regex, replacement);
  }

  if (updated !== content) {
    await fs.writeFile(filePath, updated);
  }
}

const countdownPath = path.join(root, 'countdown.svg');
let countdownSvg = await fs.readFile(countdownPath, 'utf8');

const now = new Date();
const target = new Date(targetDate);
let diffMs = target - now;
if (diffMs < 0) diffMs = 0;

const dayMs = 1000 * 60 * 60 * 24;
const hourMs = 1000 * 60 * 60;
const days = Math.floor(diffMs / dayMs);
const hours = Math.floor((diffMs / hourMs) % 24);

const countdownText = `${days.toString().padStart(3, '0')}D : ${hours
  .toString()
  .padStart(2, '0')}H`;

countdownSvg = countdownSvg.replace(
  /(<text[^>]*font-size="32"[^>]*>)([^<]*)(<\/text>)/,
  `$1${countdownText}$3`
);

await fs.writeFile(countdownPath, countdownSvg);

console.log('Synced target date and countdown assets.');
