#!/usr/bin/env npx tsx
/**
 * Generate PDF version of the Interactive Book of Prompting
 * 
 * Usage:
 *   npx tsx scripts/generate-book-pdf.ts [locale]
 * 
 * Examples:
 *   npx tsx scripts/generate-book-pdf.ts        # Generate English version (default)
 *   npx tsx scripts/generate-book-pdf.ts tr     # Generate Turkish version
 *   npx tsx scripts/generate-book-pdf.ts --all  # Generate all locales
 *   npx tsx scripts/generate-book-pdf.ts --print       # Print-ready with bleed & CMYK colors
 *   npx tsx scripts/generate-book-pdf.ts --all --print # All locales, print-ready
 */

import * as fs from 'fs';
import * as path from 'path';
import { parts, type Chapter } from '../src/lib/book/chapters';
import { getLocaleData, type LocaleData } from '../src/components/book/elements/locales';

// Configuration
const BOOK_DIR = path.join(process.cwd(), 'src/content/book');
const MESSAGES_DIR = path.join(process.cwd(), 'messages');
const OUTPUT_DIR = path.join(process.cwd(), 'public/book-pdf');
const SITE_URL = 'https://prompts.chat';

// Print-ready mode flag (set by --print CLI argument)
const PRINT_READY = process.argv.includes('--print');

// Bleed dimensions for print-ready output
const BLEED = '0.125in'; // 3mm standard bleed
const TRIM_WIDTH = '6in';
const TRIM_HEIGHT = '9in';
const BLEED_WIDTH = '6.25in';  // 6 + 0.125*2
const BLEED_HEIGHT = '9.25in'; // 9 + 0.125*2

/**
 * Interface representing a set of font families for different typographic roles.
 */
interface FontStacks {
  serif: string;
  sans: string;
  mono: string;
}

/**
 * Default font stacks used for all locales unless overridden.
 */
const DEFAULT_FONT_STACKS: FontStacks = {
  serif: `'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, 'Times New Roman', serif`,
  sans: `'Helvetica Neue', Helvetica, Arial, sans-serif`,
  mono: `'SF Mono', 'Monaco', 'Menlo', 'Inconsolata', 'Fira Code', 'Consolas', monospace`,
};

/**
 * Locale-specific font stack overrides to improve rendering for CJK and other languages.
 */
const LOCALE_FONT_STACKS: Partial<Record<string, Partial<FontStacks>>> = {
  zh: {
    serif: `'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', serif`,
    sans: `'Hiragino Sans GB', 'Noto Sans CJK SC', 'Noto Sans SC', 'Source Han Sans SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif`,
    mono: `'Noto Sans Mono CJK SC', 'Source Han Mono SC', 'Noto Sans CJK SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'SF Mono', 'Monaco', 'Menlo', 'Cascadia Mono', monospace`,
  },
  ja: {
    serif: `'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif CJK JP', 'Source Han Serif JP', serif`,
    sans: `'Hiragino Sans', 'Yu Gothic', 'Noto Sans CJK JP', 'Source Han Sans JP', Meiryo, -apple-system, BlinkMacSystemFont, sans-serif`,
    mono: `'Noto Sans Mono CJK JP', 'Source Han Mono JP', 'Noto Sans CJK JP', 'Hiragino Sans', 'Yu Gothic', Meiryo, 'SF Mono', 'Monaco', 'Menlo', 'Cascadia Mono', monospace`,
  },
  ko: {
    serif: `'AppleMyungjo', 'Nanum Myeongjo', 'Noto Serif CJK KR', 'Source Han Serif KR', serif`,
    sans: `'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans CJK KR', 'Source Han Sans KR', -apple-system, BlinkMacSystemFont, sans-serif`,
    mono: `'Noto Sans Mono CJK KR', 'Source Han Mono KR', 'Noto Sans CJK KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'SF Mono', 'Monaco', 'Menlo', 'Cascadia Mono', monospace`,
  },
};

/**
 * Get the font stacks for a specific locale.
 * Falls back to default font stacks if no locale-specific override exists.
 * 
 * @param locale - The locale string (e.g., 'en', 'zh', 'ja')
 * @returns The FontStacks object containing serif, sans, and mono font families.
 */
function getFontStacks(locale: string): FontStacks {
  const overrides = LOCALE_FONT_STACKS[locale];
  return {
    serif: overrides?.serif || DEFAULT_FONT_STACKS.serif,
    sans: overrides?.sans || DEFAULT_FONT_STACKS.sans,
    mono: overrides?.mono || DEFAULT_FONT_STACKS.mono,
  };
}

// Components that truly need interactivity (API calls, complex animations)
// Everything else gets static rendering
const INTERACTIVE_ONLY_COMPONENTS = [
  'PromptAnalyzer',  // Needs live API calls
  'RunPromptButton',
  'CodeEditor',
];

/**
 * Load UI messages from messages/*.json
 */
function loadMessages(locale: string): Record<string, unknown> {
  try {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    // Fallback to English
    const filePath = path.join(MESSAGES_DIR, 'en.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
}

/**
 * Get a nested translation key from messages
 */
function t(messages: Record<string, unknown>, key: string): string {
  const keys = key.split('.');
  let current: unknown = messages;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return key; // Fallback to key itself
    }
  }
  return typeof current === 'string' ? current : key;
}

// Components with explicit static renderers (handled individually in transformMdxForPdf)
const STATICALLY_RENDERED_COMPONENTS = [
  'TryIt', 'Quiz', 'Callout', 'InfoGrid', 'Checklist', 'Compare',
  'FillInTheBlank', 'InteractiveChecklist', 'PromptDebugger',
  'PromptChallenge', 'BeforeAfterEditor', 'DiffView', 'VersionDiff',
  'TokenizerDemo', 'TokenPredictionDemo', 'ContextWindowDemo',
  'TemperatureDemo', 'StructuredOutputDemo', 'FewShotDemo',
  'JsonYamlDemo', 'IterativeRefinementDemo', 'CostCalculatorDemo',
  'EmbeddingsDemo', 'LLMCapabilitiesDemo',
  'JailbreakDemo', 'TextToImageDemo', 'TextToVideoDemo',
  'SummarizationDemo', 'ContextPlayground',
  'ValidationDemo', 'FallbackDemo', 'ContentPipelineDemo',
  'ChainExample', 'ChainFlowDemo', 'ChainErrorDemo',
  'FrameworkDemo', 'CRISPEFramework', 'BREAKFramework', 'RTFFramework',
  'PromptBreakdown', 'SpecificitySpectrum', 'PrinciplesSummary',
  'PromptBuilder', 'BookPartsNav',
  'HarnessDemo',
  'ToolsDemo',
  'Collapsible', 'CopyableCode',
];


// Localization for the interactive notice
const INTERACTIVE_NOTICES: Record<string, string> = {
  en: '📖 This is an interactive element. Visit prompts.chat/book to try it live!',
  tr: '📖 Bu etkileşimli bir öğedir. Canlı denemek için prompts.chat/book adresini ziyaret edin!',
  es: '📖 Este es un elemento interactivo. ¡Visita prompts.chat/book para probarlo en vivo!',
  de: '📖 Dies ist ein interaktives Element. Besuchen Sie prompts.chat/book, um es live auszuprobieren!',
  fr: '📖 Ceci est un élément interactif. Visitez prompts.chat/book pour l\'essayer en direct!',
  pt: '📖 Este é um elemento interativo. Visite prompts.chat/book para experimentá-lo ao vivo!',
  zh: '📖 这是一个互动元素。访问 prompts.chat/book 进行在线体验！',
  ja: '📖 これはインタラクティブな要素です。prompts.chat/book でライブで試してみてください！',
  ko: '📖 이것은 인터랙티브 요소입니다. prompts.chat/book을 방문하여 직접 체험해 보세요!',
  ar: '📖 هذا عنصر تفاعلي. قم بزيارة prompts.chat/book لتجربته مباشرة!',
  it: '📖 Questo è un elemento interattivo. Visita prompts.chat/book per provarlo dal vivo!',
  ru: '📖 Это интерактивный элемент. Посетите prompts.chat/book, чтобы попробовать вживую!',
  fa: '📖 این یک عنصر تعاملی است. برای امتحان زنده به prompts.chat/book مراجعه کنید!',
  nl: '📖 Dit is een interactief element. Bezoek prompts.chat/book om het live te proberen!',
  el: '📖 Αυτό είναι ένα διαδραστικό στοιχείο. Επισκεφθείτε το prompts.chat/book για να το δοκιμάσετε ζωντανά!',
  az: '📖 Bu interaktiv elementdir. Canlı sınamaq üçün prompts.chat/book saytına daxil olun!',
  he: '📖 זהו אלמנט אינטראקטיבי. בקרו ב-prompts.chat/book כדי לנסות אותו בזמן אמת!',
};

/**
 * Inline SVG icons for print-ready mode (emojis don't render reliably in CMYK print).
 * Each icon is a 14x14 inline SVG with currentColor stroke.
 */
const SVG_ICONS: Record<string, string> = {
  zap:       '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  quiz:      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
  info:      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  warning:   '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  tip:       '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/></svg>',
  pencil:    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  search:    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  trophy:    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>',
  refresh:   '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
  palette:   '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
  video:     '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  shield:    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  book:      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>',
  gem:       '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 3 18 3 22 9 12 22 2 9"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="12" y1="22" x2="6" y2="9"/><line x1="12" y1="22" x2="18" y2="9"/></svg>',
  target:    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  crown:     '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><line x1="2" y1="21" x2="22" y2="21"/></svg>',
  compass:   '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  sparkles:  '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.912 5.813L20 12l-6.088 3.187L12 21l-1.912-5.813L4 12l6.088-3.187z"/></svg>',
  ruler:     '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.73 18l-8-14a2 2 0 00-3.48 0l-8 14A2 2 0 004 21h16a2 2 0 001.73-3z"/></svg>',
  check:     '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  checkbox:  '<svg class="ico-sm" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="14" height="14" rx="2"/></svg>',
};

/**
 * Return icon markup: SVG for print, emoji for screen
 */
function icon(name: string, emoji: string): string {
  if (PRINT_READY && SVG_ICONS[name]) {
    return SVG_ICONS[name];
  }
  return emoji;
}

// Fallback book titles (used if messages don't have book.title)
const BOOK_TITLES_FALLBACK: Record<string, string> = {
  en: 'The Interactive Book of Prompting',
  tr: 'İnteraktif Prompt Yazma Kitabı',
};

interface ProcessedChapter {
  slug: string;
  title: string;
  part: string;
  content: string;
}

/**
 * Get available locales from the book directory
 */
function getAvailableLocales(): string[] {
  const entries = fs.readdirSync(BOOK_DIR, { withFileTypes: true });
  const locales = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  
  // Add 'en' as it's the default (files in root)
  if (!locales.includes('en')) {
    locales.unshift('en');
  }
  
  return locales;
}

/**
 * Get the path to MDX files for a locale
 */
function getLocalePath(locale: string): string {
  if (locale === 'en') {
    return BOOK_DIR;
  }
  return path.join(BOOK_DIR, locale);
}

/**
 * Check if a chapter exists for a locale
 */
function chapterExists(locale: string, slug: string): boolean {
  const localePath = getLocalePath(locale);
  const filePath = path.join(localePath, `${slug}.mdx`);
  return fs.existsSync(filePath);
}

/**
 * Extract prompt content from TryIt component
 */
function extractTryItPrompt(content: string): string | null {
  // Match prompt={`...`} or prompt="..."
  const backtickMatch = content.match(/prompt=\{`([\s\S]*?)`\}/);
  if (backtickMatch) return backtickMatch[1];
  
  const quoteMatch = content.match(/prompt="([^"]*?)"/);
  if (quoteMatch) return quoteMatch[1];
  
  return null;
}

/**
 * Extract Quiz content
 */
function extractQuizContent(content: string): { question: string; options: string[]; explanation: string } | null {
  const questionMatch = content.match(/question="((?:[^"\\]|\\.)*)"/);
  const optionsMatch = content.match(/options=\{\[([\s\S]*?)\]\}/);
  const explanationMatch = content.match(/explanation="((?:[^"\\]|\\.)*)"/);
  
  if (!questionMatch || !optionsMatch) return null;
  
  const question = questionMatch[1].replace(/\\"/g, '"');
  const optionsStr = optionsMatch[1];
  const options: string[] = [];
  const optRegex = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = optRegex.exec(optionsStr)) !== null) {
    options.push(m[1].replace(/\\"/g, '"'));
  }
  const explanation = explanationMatch ? explanationMatch[1].replace(/\\"/g, '"') : '';
  
  return { question, options, explanation };
}

/**
 * Extract Callout content
 */
function extractCalloutContent(match: string): { type: string; title: string; content: string } {
  const typeMatch = match.match(/type="([^"]*?)"/);
  const titleMatch = match.match(/title="([^"]*?)"/);
  
  // Extract content between > and </Callout>
  const contentMatch = match.match(/>\s*([\s\S]*?)\s*<\/Callout>/);
  
  return {
    type: typeMatch ? typeMatch[1] : 'info',
    title: titleMatch ? titleMatch[1] : '',
    content: contentMatch ? contentMatch[1].trim() : '',
  };
}

/**
 * Extract InfoGrid items
 */
function extractInfoGridItems(content: string): { label: string; description: string }[] {
  const itemsMatch = content.match(/items=\{\[([\s\S]*?)\]\}/);
  if (!itemsMatch) return [];
  
  const items: { label: string; description: string }[] = [];
  // Handle escaped quotes inside strings: match "..." allowing \" inside
  const itemRegex = /\{\s*label:\s*"((?:[^"\\]|\\.)*)"\s*,\s*description:\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  
  while ((match = itemRegex.exec(itemsMatch[1])) !== null) {
    // Unescape the \" back to "
    const label = match[1].replace(/\\"/g, '"');
    const description = match[2].replace(/\\"/g, '"');
    items.push({ label, description });
  }
  
  return items;
}

/**
 * Extract Checklist items
 */
function extractChecklistItems(content: string): { title: string; items: string[] } {
  const titleMatch = content.match(/title="([^"]*?)"/);
  const itemsMatch = content.match(/items=\{\[([\s\S]*?)\]\}/);
  
  const title = titleMatch ? titleMatch[1] : '';
  const items: string[] = [];
  
  if (itemsMatch) {
    const textRegex = /text:\s*"([^"]*?)"/g;
    let match;
    while ((match = textRegex.exec(itemsMatch[1])) !== null) {
      items.push(match[1]);
    }
  }
  
  return { title, items };
}

/**
 * Extract props from a JSX-like component string
 */
function extractProps(content: string): Record<string, string> {
  const props: Record<string, string> = {};
  // Simple string props: key="value" (handles escaped quotes)
  const stringRegex = /(\w+)="((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = stringRegex.exec(content)) !== null) {
    props[m[1]] = m[2].replace(/\\"/g, '"');
  }
  // Template literal props: key={`value`}
  const templateRegex = /(\w+)=\{`([\s\S]*?)`\}/g;
  while ((m = templateRegex.exec(content)) !== null) {
    props[m[1]] = m[2];
  }
  return props;
}

/** Read plain string fields without evaluating a component's MDX expression. */
function extractObjectStringFields(source: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of source.matchAll(/\b(\w+):\s*("(?:[^"\\]|\\.)*")/g)) {
    values[field[1]] = JSON.parse(field[2]) as string;
  }
  return values;
}

/**
 * Extract array of objects from items={[...]} prop
 */
function extractArrayProp(content: string, propName: string): Record<string, string>[] {
  const regex = new RegExp(`${propName}=\\{\\[([\\s\\S]*?)\\]\\}`, 'g');
  const match = regex.exec(content);
  if (!match) return [];
  
  const items: Record<string, string>[] = [];
  const objRegex = /\{([^{}]*?)\}/g;
  let m;
  while ((m = objRegex.exec(match[1])) !== null) {
    const obj: Record<string, string> = {};
    // Handle escaped quotes in field values
    const fieldRegex = /(\w+):\s*"((?:[^"\\]|\\.)*)"/g;
    let fm;
    while ((fm = fieldRegex.exec(m[1])) !== null) {
      obj[fm[1]] = fm[2].replace(/\\"/g, '"');
    }
    if (Object.keys(obj).length > 0) items.push(obj);
  }
  return items;
}

/**
 * Transform MDX content for PDF - convert interactive components to static
 */
function transformMdxForPdf(content: string, locale: string, localeData?: LocaleData, messages?: Record<string, unknown>): string {
  let result = content;
  const noticeRaw = INTERACTIVE_NOTICES[locale] || INTERACTIVE_NOTICES.en;
  const notice = PRINT_READY ? noticeRaw.replace('📖', icon('book', '📖')) : noticeRaw;
  const msg = messages || {};
  const ld = localeData || getLocaleData('en');
  
  // Translated UI labels
  const labels = {
    tryIt: t(msg, 'book.interactive.tryIt') || 'Try This Prompt',
    quiz: t(msg, 'book.interactive.quiz') || 'Quiz',
    answer: t(msg, 'book.interactive.answer') || 'Answer',
    prompt: t(msg, 'book.interactive.prompt') || 'Prompt',
    output: t(msg, 'book.interactive.outputLabel') || 'Output',
    answers: t(msg, 'book.interactive.answers') || 'Answers',
    completePrompt: t(msg, 'book.interactive.completePrompt') || 'Complete Prompt',
    examplePrompts: t(msg, 'book.interactive.examplePrompts') || 'Example prompts',
  };
  
  // In print mode, remove author social links from preface
  if (PRINT_READY) {
    result = result.replace(/<div className="flex gap-3 mt-3">[\s\S]*?<\/div>/g, '');
  }
  
  // Remove navigation components entirely
  result = result.replace(/<NavButton[^>]*\/>/g, '');
  result = result.replace(/<NavFooter[^>]*\/>/g, '');
  result = result.replace(/<BookPartsNav[^>]*\/>/g, '');
  
  // ============================================================
  // TryIt - Show prompt as styled code block
  // ============================================================
  result = result.replace(/<TryIt\s+([\s\S]*?)\/>/g, (match, attrs) => {
    const prompt = extractTryItPrompt(match);
    const titleMatch = attrs.match(/title="([^"]*?)"/);
    const descMatch = attrs.match(/description="([^"]*?)"/);
    
    const title = titleMatch ? titleMatch[1] : labels.tryIt;
    const desc = descMatch ? descMatch[1] : '';
    
    if (prompt) {
      const printablePrompt = convertPromptVariables(prompt);
      const protectedPrompt = protectCodeBlock(escapeHtml(printablePrompt));
      return `
<div class="tryit-box">
  <div class="tryit-header">${icon('zap', '⚡')} ${escapeHtml(title)}</div>
  ${desc ? `<p class="tryit-desc">${escapeHtml(desc)}</p>` : ''}
  <pre class="prompt-code">${protectedPrompt}</pre>
</div>
`;
    }
    return '';
  });
  
  // ============================================================
  // Quiz - Show question, options, and answer
  // ============================================================
  result = result.replace(/<Quiz\s+([\s\S]*?)\/>/g, (match) => {
    const quiz = extractQuizContent(match);
    if (quiz) {
      const correctIdx = match.match(/correctIndex=\{(\d+)\}/);
      const correctNum = correctIdx ? parseInt(correctIdx[1]) : -1;
      const optionsHtml = quiz.options.map((opt, i) => {
        const marker = i === correctNum ? '●' : '○';
        const cls = i === correctNum ? ' class="quiz-correct"' : '';
        return `<div${cls}>${marker} ${opt}</div>`;
      }).join('\n');
      return `
<div class="quiz-box">
  <div class="quiz-header">${icon('quiz', '📝')} Quiz</div>
  <p class="quiz-question"><strong>${quiz.question}</strong></p>
  <div class="quiz-options">${optionsHtml}</div>
  ${quiz.explanation ? `<p class="quiz-explanation"><strong>Answer:</strong> ${quiz.explanation}</p>` : ''}
</div>
`;
    }
    return '';
  });
  
  // ============================================================
  // Callout - Static info boxes
  // ============================================================
  result = result.replace(/<Callout\s+([\s\S]*?)<\/Callout>/g, (match) => {
    const callout = extractCalloutContent(match);
    const calloutIcons: Record<string, [string, string]> = { info: ['info', 'ℹ️'], warning: ['warning', '⚠️'], tip: ['tip', '💡'], example: ['zap', '⚡'] };
    const ci = calloutIcons[callout.type] || calloutIcons.info;
    return `
<div class="callout callout-${callout.type}">
  <div class="callout-header">${icon(ci[0], ci[1])} ${callout.title}</div>
  <div class="callout-content">${callout.content}</div>
</div>
`;
  });
  
  // ============================================================
  // InfoGrid - Static grid
  // ============================================================
  result = result.replace(/<InfoGrid\s+([\s\S]*?)\/>/g, (match) => {
    const items = extractInfoGridItems(match);
    if (items.length > 0) {
      const itemsHtml = items.map(item => 
        `<div class="info-item"><strong>${item.label}</strong>: ${item.description}</div>`
      ).join('\n');
      return `<div class="info-grid">\n${itemsHtml}\n</div>`;
    }
    return '';
  });
  
  // ============================================================
  // Checklist (simple) - Printable checkbox list
  // ============================================================
  result = result.replace(/<Checklist\s+([\s\S]*?)\/>/g, (match) => {
    const checklist = extractChecklistItems(match);
    const cb = icon('checkbox', '☐');
    const itemsHtml = checklist.items.map(item => `<li>${cb} ${item}</li>`).join('\n');
    return `
<div class="checklist">
  ${checklist.title ? `<div class="checklist-title">${checklist.title}</div>` : ''}
  <ul>${itemsHtml}</ul>
</div>
`;
  });
  
  // ============================================================
  // Compare - Side by side (handles object syntax {{ label, content }})
  // ============================================================
  result = result.replace(/<Compare\s+([\s\S]*?)\/>/g, (match) => {
    // Try object syntax: before={{ label: "...", content: "..." or `...` }}
    const extractSide = (side: string): { label: string; content: string } | null => {
      const objRegex = new RegExp(`${side}=\\{\\{[\\s\\S]*?\\}\\}`);
      const objMatch = match.match(objRegex);
      if (!objMatch) return null;
      const block = objMatch[0];
      const labelMatch = block.match(/label:\s*"((?:[^"\\]|\\.)*)"/);
      const contentQuote = block.match(/content:\s*"((?:[^"\\]|\\.)*)"/);
      const contentBt = block.match(/content:\s*`([\s\S]*?)`/);
      const label = labelMatch ? labelMatch[1].replace(/\\"/g, '"') : side;
      const content = contentBt ? contentBt[1] : (contentQuote ? contentQuote[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '');
      return { label, content };
    };

    const before = extractSide('before');
    const after = extractSide('after');

    // Fallback: simple string props
    if (!before || !after) {
      const beforeSimple = match.match(/before="((?:[^"\\]|\\.)*)"/);
      const afterSimple = match.match(/after="((?:[^"\\]|\\.)*)"/);
      if (beforeSimple && afterSimple) {
        return `
<div class="compare-box">
  <div class="compare-item compare-before"><strong>Before:</strong> ${beforeSimple[1].replace(/\\"/g, '"')}</div>
  <div class="compare-item compare-after"><strong>After:</strong> ${afterSimple[1].replace(/\\"/g, '"')}</div>
</div>
`;
      }
      return '';
    }

    const beforeContent = protectCodeBlock(escapeHtml(before.content));
    const afterContent = protectCodeBlock(escapeHtml(after.content));

    return `
<div class="compare-box">
  <div class="compare-item compare-before"><strong>${escapeHtml(before.label)}</strong><pre class="prompt-code">${beforeContent}</pre></div>
  <div class="compare-item compare-after"><strong>${escapeHtml(after.label)}</strong><pre class="prompt-code">${afterContent}</pre></div>
</div>
`;
  });

  // ============================================================
  // FillInTheBlank - Printable exercise with blanks
  // ============================================================
  result = result.replace(/<FillInTheBlank\s+([\s\S]*?)\/>/g, (match) => {
    const props = extractProps(match);
    const title = props.title || 'Fill in the Blanks';

    // Extract template
    const templateMatch = match.match(/template="([^"]*?)"/);
    const templateBt = match.match(/template=\{`([\s\S]*?)`\}/);
    const template = templateBt ? templateBt[1] : (templateMatch ? templateMatch[1] : '');

    // Extract blanks with correct answers
    const blanks = extractArrayProp(match, 'blanks');

    // Replace {{id}} in template with labeled blanks
    const rendered = template.replace(/\{\{(\w+)\}\}/g, (_, id) => {
      const blank = blanks.find(b => b.id === id);
      const hint = blank?.correctAnswers || blank?.hint || '';
      if (hint) {
        return `_______ (${id}, e.g. ${hint})`;
      }
      return `_______ (${id})`;
    });

    const answersHtml = blanks.length > 0 ? blanks.map(b => {
      const answers = b.correctAnswers || '';
      return `<li><strong>${b.id}:</strong> ${answers}</li>`;
    }).join('\n') : '';

    const protectedTemplate = protectCodeBlock(escapeHtml(rendered));

    return `
<div class="exercise-box">
  <div class="exercise-header">${icon('pencil', '✏️')} ${escapeHtml(title)}</div>
  <pre class="prompt-code">${protectedTemplate}</pre>
  ${answersHtml ? `<div class="exercise-answers"><strong>Answers:</strong><ul>${answersHtml}</ul></div>` : ''}
</div>
`;
  });

  // ============================================================
  // InteractiveChecklist - Printable checklist
  // ============================================================
  result = result.replace(/<InteractiveChecklist\s+([\s\S]*?)\/>/g, (match) => {
    const props = extractProps(match);
    const title = props.title || 'Checklist';
    const items = extractArrayProp(match, 'items');
    const itemsHtml = items.map(item => 
      `<li>${icon('checkbox', '☐')} <strong>${item.label || ''}</strong>${item.description ? ` — ${item.description}` : ''}</li>`
    ).join('\n');
    return `
<div class="checklist">
  <div class="checklist-title">${escapeHtml(title)}</div>
  <ul>${itemsHtml}</ul>
</div>
`;
  });

  // ============================================================
  // PromptDebugger - Show prompt, bad output, and options
  // ============================================================
  result = result.replace(/<PromptDebugger\s+([\s\S]*?)\/>/g, (match) => {
    const props = extractProps(match);
    const title = props.title || 'Debug This Prompt';
    const badPrompt = props.badPrompt || '';
    const badOutput = props.badOutput || '';
    const hint = props.hint || '';
    const options = extractArrayProp(match, 'options');

    const protectedBadPrompt = protectCodeBlock(escapeHtml(badPrompt));
    const protectedBadOutput = protectCodeBlock(escapeHtml(badOutput));

    const optionsHtml = options.map(opt => {
      const marker = opt.isCorrect === 'true' ? '✓' : '○';
      const cls = opt.isCorrect === 'true' ? ' class="quiz-correct"' : '';
      return `<div${cls}>${marker} ${opt.label || ''}</div>`;
    }).join('\n');

    return `
<div class="exercise-box">
  <div class="exercise-header">${icon('search', '🔍')} ${escapeHtml(title)}</div>
  <div class="exercise-section"><strong>The Prompt:</strong></div>
  <pre class="prompt-code">${protectedBadPrompt}</pre>
  <div class="exercise-section"><strong>The Output (problematic):</strong></div>
  <pre class="prompt-code prompt-code-error">${protectedBadOutput}</pre>
  ${hint ? `<p class="exercise-hint">${icon('tip', '💡')} Hint: ${escapeHtml(hint)}</p>` : ''}
  <div class="exercise-section"><strong>What's wrong?</strong></div>
  <div class="quiz-options">${optionsHtml}</div>
</div>
`;
  });

  // ============================================================
  // PromptChallenge - Show task, criteria, and example solution
  // ============================================================
  result = result.replace(/<PromptChallenge\s+([\s\S]*?)\/>/g, (match) => {
    const props = extractProps(match);
    const title = props.title || 'Prompt Challenge';
    const task = props.task || '';
    const difficulty = props.difficulty || 'intermediate';
    const exampleSolution = props.exampleSolution || '';
    const criteria: string[] = [];
    const criteriaMatch = match.match(/criteria=\{\[([\s\S]*?)\]\}/);
    if (criteriaMatch) {
      const strRegex = /"([^"]*?)"/g;
      let cm;
      while ((cm = strRegex.exec(criteriaMatch[1])) !== null) {
        criteria.push(cm[1]);
      }
    }

    const criteriaHtml = criteria.map(c => `<li>${icon('checkbox', '☐')} ${c}</li>`).join('\n');

    return `
<div class="exercise-box">
  <div class="exercise-header">${icon('trophy', '🏆')} ${escapeHtml(title)} <span class="difficulty-badge">${difficulty}</span></div>
  <p>${escapeHtml(task)}</p>
  ${criteria.length > 0 ? `<div class="exercise-section"><strong>Criteria:</strong></div><ul>${criteriaHtml}</ul>` : ''}
  ${exampleSolution ? `<div class="exercise-section"><strong>Example Solution:</strong></div><pre class="prompt-code">${protectCodeBlock(escapeHtml(exampleSolution))}</pre>` : ''}
</div>
`;
  });

  // ============================================================
  // BeforeAfterEditor - Show both prompts side by side
  // ============================================================
  result = result.replace(/<BeforeAfterEditor\s+([\s\S]*?)\/>/g, (match) => {
    const props = extractProps(match);
    const title = props.title || 'Before & After';
    const badPrompt = props.badPrompt || '';
    const idealPrompt = props.idealPrompt || '';
    const task = props.task || '';

    return `
<div class="exercise-box">
  <div class="exercise-header">${icon('refresh', '🔄')} ${escapeHtml(title)}</div>
  ${task ? `<p>${escapeHtml(task)}</p>` : ''}
  <div class="compare-box">
    <div class="compare-item compare-before"><strong>Before:</strong><pre class="prompt-code">${protectCodeBlock(escapeHtml(badPrompt))}</pre></div>
    <div class="compare-item compare-after"><strong>After:</strong><pre class="prompt-code">${protectCodeBlock(escapeHtml(idealPrompt))}</pre></div>
  </div>
</div>
`;
  });

  // ============================================================
  // DiffView - Show before/after comparison
  // ============================================================
  result = result.replace(/<DiffView\s+([\s\S]*?)\/>/g, (match) => {
    const props = extractProps(match);
    const beforeLabel = props.beforeLabel || 'Before';
    const afterLabel = props.afterLabel || 'After';
    const before = props.before || '';
    const after = props.after || '';
    return `
<div class="compare-box">
  <div class="compare-item compare-before"><strong>${escapeHtml(beforeLabel)}:</strong><pre class="prompt-code">${protectCodeBlock(escapeHtml(before))}</pre></div>
  <div class="compare-item compare-after"><strong>${escapeHtml(afterLabel)}:</strong><pre class="prompt-code">${protectCodeBlock(escapeHtml(after))}</pre></div>
</div>
`;
  });

  // ============================================================
  // TokenizerDemo - Static example with colored tokens
  // ============================================================
  result = result.replace(/<TokenizerDemo\s*\/>/g, () => {
    const sample = ld.tokenizer.samples[ld.tokenizer.default];
    const example = sample?.text || 'Hello, world!';
    const tokens = sample?.tokens || ['Hel', 'lo', ',', ' wor', 'ld', '!'];
    const colors = ['#dbeafe', '#dcfce7', '#f3e8ff', '#fef3c7', '#fce7f3', '#cffafe'];
    const tokensHtml = tokens.map((tk, i) => 
      `<span style="background:${colors[i % colors.length]};padding:2px 6px;border-radius:3px;margin:2px;display:inline-block;font-family:var(--font-mono);font-size:8.5pt;">${tk === ' ' ? '␣' : escapeHtml(tk)}</span>`
    ).join('');
    return `
<div class="demo-box">
  <div class="demo-header">Tokenizer</div>
  <p class="demo-label">Input: "${escapeHtml(example)}"</p>
  <p class="demo-label">Tokens (${tokens.length}):</p>
  <div style="margin:0.5em 0;">${tokensHtml}</div>
  <p class="demo-note">${escapeHtml(ld.tokenizer.tryExamples)}</p>
</div>
`;
  });

  // ============================================================
  // TokenPredictionDemo - Static next-token prediction
  // ============================================================
  result = result.replace(/<TokenPredictionDemo\s*\/>/g, () => {
    const tp = ld.tokenPrediction;
    const stepKeys = Object.keys(tp.predictions.steps);
    const stepsHtml = stepKeys.slice(0, 3).map(key => {
      const preds = tp.predictions.steps[key];
      const predsHtml = preds.map(p => `<span class="prediction-token">${escapeHtml(p.token)} <span class="prediction-prob">${Math.round(p.probability * 100)}%</span></span>`).join(' ');
      return `<div class="prediction-step"><div class="prediction-context">"${escapeHtml(key)} ▁▁▁"</div><div class="prediction-options">→ ${predsHtml}</div></div>`;
    }).join('\n');
    return `
<div class="demo-box">
  <div class="demo-header">Next-Token Prediction</div>
  <p class="demo-note">${escapeHtml(tp.fullText)}</p>
  ${stepsHtml}
</div>
`;
  });

  // ============================================================
  // ContextWindowDemo - Static diagram
  // ============================================================
  result = result.replace(/<ContextWindowDemo\s*\/>/g, () => {
    const cwLabel = t(msg, 'book.interactive.contextWindow') || 'Context Window';
    const promptLabel = t(msg, 'book.interactive.prompt') || 'Prompt';
    const responseLabel = t(msg, 'book.interactive.response') || 'Response';
    const remainingLabel = t(msg, 'book.interactive.remaining') || 'Remaining';
    const tipText = t(msg, 'book.interactive.contextTip') || '';
    return `
<div class="demo-box">
  <div class="demo-header">${escapeHtml(cwLabel)} — 8,000 tokens</div>
  <table style="width:100%;border-collapse:collapse;font-size:8pt;margin:0.8em 0;">
    <tr>
      <td style="width:25%;padding:0.4em;border:1px solid #ccc;text-align:center;font-weight:600;">${escapeHtml(promptLabel)}<br/>2,000 tokens</td>
      <td style="width:12.5%;padding:0.4em;border:1px solid #ccc;text-align:center;font-weight:600;">${escapeHtml(responseLabel)}<br/>1,000 tokens</td>
      <td style="width:62.5%;padding:0.4em;border:1px solid #ccc;text-align:center;color:#666;">${escapeHtml(remainingLabel)} — 5,000 tokens</td>
    </tr>
  </table>
  ${tipText ? `<p class="demo-note">${escapeHtml(tipText)}</p>` : ''}
</div>
`;
  });

  // ============================================================
  // TemperatureDemo - Show all temperature levels
  // ============================================================
  result = result.replace(/<TemperatureDemo\s*\/>/g, () => {
    const te = ld.temperatureExamples;
    const levels = [
      { temp: '0.0–0.2', label: t(msg, 'book.interactive.deterministic') || 'Deterministic', examples: te.lowTemp.slice(0, 2) },
      { temp: '0.5–0.7', label: t(msg, 'book.interactive.balanced') || 'Balanced', examples: te.mediumHighTemp.slice(0, 2) },
      { temp: '0.8–1.0', label: t(msg, 'book.interactive.veryCreative') || 'Creative', examples: te.highTemp.slice(0, 2) },
    ];
    const levelsHtml = levels.map(l => `
      <div class="temp-level">
        <div class="temp-label"><strong>${l.temp}</strong> — ${escapeHtml(l.label)}</div>
        <div class="temp-examples">${l.examples.map(e => `<div class="temp-example">"${escapeHtml(e)}"</div>`).join('')}</div>
      </div>
    `).join('');
    return `
<div class="demo-box">
  <div class="demo-header">${t(msg, 'book.interactive.temperatureDemo') || 'Temperature'}</div>
  <p class="demo-note">${t(msg, 'book.interactive.prompt') || 'Prompt'}: "${escapeHtml(te.prompt)}"</p>
  ${levelsHtml}
</div>
`;
  });

  // ============================================================
  // StructuredOutputDemo - Show all three formats
  // ============================================================
  result = result.replace(/<StructuredOutputDemo\s*\/>/g, () => {
    const unstructured = 'Here are some popular programming languages: Python is great for data science and AI. JavaScript is used for web development. Rust is known for performance and safety.';
    const json = `{
  "languages": [
    { "name": "Python", "best_for": ["data science", "AI"], "difficulty": "easy" },
    { "name": "JavaScript", "best_for": ["web development"], "difficulty": "medium" },
    { "name": "Rust", "best_for": ["performance", "safety"], "difficulty": "hard" }
  ]
}`;
    return `
<div class="demo-box">
  <div class="demo-header">Structured Output Comparison</div>
  <div class="demo-section"><strong>Unstructured:</strong></div>
  <div class="demo-text">${escapeHtml(unstructured)}</div>
  <div class="demo-section"><strong>Structured (JSON):</strong></div>
  <pre class="prompt-code">${protectCodeBlock(escapeHtml(json))}</pre>
  <p class="demo-note">Structured output allows programmatic parsing, comparison across queries, and integration into workflows.</p>
</div>
`;
  });

  // ============================================================
  // FewShotDemo - Show progression of examples
  // ============================================================
  result = result.replace(/<FewShotDemo\s*\/>/g, () => {
    return `
<div class="demo-box">
  <div class="demo-header">Few-Shot Learning</div>
  <p class="demo-note">More examples help the model understand the pattern:</p>
  <table class="demo-table">
    <thead><tr><th>Examples</th><th>Prediction</th><th>Confidence</th></tr></thead>
    <tbody>
      <tr><td>0 (zero-shot)</td><td>Positive ✗</td><td>45%</td></tr>
      <tr><td>1 (one-shot)</td><td>Positive ✗</td><td>62%</td></tr>
      <tr><td>2 (two-shot)</td><td>Mixed ✓</td><td>71%</td></tr>
      <tr><td>3 (three-shot)</td><td>Mixed ✓</td><td>94%</td></tr>
    </tbody>
  </table>
  <p class="demo-note">Test input: "Great quality but shipping was slow" → Expected: Mixed</p>
</div>
`;
  });

  // ============================================================
  // JsonYamlDemo - Show all three formats
  // ============================================================
  result = result.replace(/<JsonYamlDemo\s*\/>/g, () => {
    const ts = `interface ChatPersona {
  name?: string;
  role?: string;
  tone?: PersonaTone | PersonaTone[];
  expertise?: PersonaExpertise[];
}`;
    const json = `{
  "name": "CodeReviewer",
  "role": "Senior Software Engineer",
  "tone": ["professional", "analytical"],
  "expertise": ["coding", "engineering"]
}`;
    const yaml = `name: CodeReviewer
role: Senior Software Engineer
tone:
  - professional
  - analytical
expertise:
  - coding
  - engineering`;
    return `
<div class="demo-box">
  <div class="demo-header">Format Comparison: TypeScript / JSON / YAML</div>
  <div class="demo-section"><strong>TypeScript (define schema):</strong></div>
  <pre class="prompt-code">${protectCodeBlock(escapeHtml(ts))}</pre>
  <div class="demo-section"><strong>JSON (APIs &amp; parsing):</strong></div>
  <pre class="prompt-code">${protectCodeBlock(escapeHtml(json))}</pre>
  <div class="demo-section"><strong>YAML (config files):</strong></div>
  <pre class="prompt-code">${protectCodeBlock(escapeHtml(yaml))}</pre>
</div>
`;
  });

  // ============================================================
  // IterativeRefinementDemo - Show all versions
  // ============================================================
  result = result.replace(/<IterativeRefinementDemo\s*\/>/g, () => {
    const versions = [
      { v: 1, prompt: 'Write a product description.', output: 'This is a great product. It has many features. You should buy it.', quality: 20, issue: 'Too vague, no specific details' },
      { v: 2, prompt: 'Write a product description for wireless earbuds.', output: 'These wireless earbuds offer great sound quality and comfortable fit. They have long battery life.', quality: 45, issue: 'Better, but still generic' },
      { v: 3, prompt: 'Write a 50-word product description for premium wireless earbuds. Highlight: noise cancellation, 8-hour battery, water resistance.', output: 'Experience pure audio bliss with our premium wireless earbuds. Advanced noise cancellation blocks distractions while delivering crystal-clear sound.', quality: 72, issue: 'Good details, needs stronger hook' },
      { v: 4, prompt: 'Write a compelling 50-word product description for premium wireless earbuds.\nKey features: noise cancellation, 8-hour battery, IPX5\nTone: Premium but approachable\nStart with a benefit, end with a call to action.', output: 'Escape the noise and immerse yourself in studio-quality sound. Our premium wireless earbuds feature advanced noise cancellation, 8-hour battery life, and IPX5 water resistance.', quality: 95, issue: null },
    ];
    const versionsHtml = versions.map(v => `
      <div class="iteration-step">
        <div class="iteration-header">Version ${v.v} — Quality: ${v.quality}%</div>
        <pre class="prompt-code">${protectCodeBlock(escapeHtml(v.prompt))}</pre>
        <div class="iteration-output">${escapeHtml(v.output)}</div>
        ${v.issue ? `<div class="iteration-issue">⚠ ${v.issue}</div>` : '<div class="iteration-success">✓ Strong prompt with clear structure</div>'}
      </div>
    `).join('');
    return `
<div class="demo-box">
  <div class="demo-header">Iterative Refinement</div>
  <p class="demo-note">Watch how a prompt improves through successive iterations:</p>
  ${versionsHtml}
</div>
`;
  });

  // ============================================================
  // CostCalculatorDemo - Static calculation example
  // ============================================================
  result = result.replace(/<CostCalculatorDemo\s*\/>/g, () => {
    return `
<div class="demo-box">
  <div class="demo-header">API Cost Calculator</div>
  <table class="demo-table">
    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Input tokens per request</td><td>500</td></tr>
      <tr><td>Output tokens per request</td><td>200</td></tr>
      <tr><td>Input price</td><td>$0.15 / 1M tokens</td></tr>
      <tr><td>Output price</td><td>$0.60 / 1M tokens</td></tr>
      <tr><td>Requests per day</td><td>1,000</td></tr>
    </tbody>
  </table>
  <div class="cost-results">
    <div class="cost-item"><strong>Per request:</strong> $0.0002</div>
    <div class="cost-item"><strong>Daily:</strong> $0.20</div>
    <div class="cost-item"><strong>Monthly:</strong> $5.85</div>
  </div>
  <p class="demo-note" style="font-family:var(--font-mono);font-size:8pt;text-align:center;">(500 × $0.15/1M) + (200 × $0.60/1M) = $0.000195/request</p>
</div>
`;
  });

  // ============================================================
  // EmbeddingsDemo - Show word vectors and similarity
  // ============================================================
  result = result.replace(/<EmbeddingsDemo\s*\/>/g, () => {
    const words = ld.embeddingWords;
    const rowsHtml = words.map(w => 
      `<tr><td>${escapeHtml(w.word)}</td><td>[${w.vector.join(', ')}]</td><td>${escapeHtml(w.color)}</td></tr>`
    ).join('\n');
    return `
<div class="demo-box">
  <div class="demo-header">Word Embeddings</div>
  <table class="demo-table">
    <thead><tr><th>Word</th><th>Vector</th><th>Group</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</div>
`;
  });

  // ============================================================
  // LLMCapabilitiesDemo - Static capability list
  // ============================================================
  result = result.replace(/<LLMCapabilitiesDemo\s*\/>/g, () => {
    const canDo = ld.capabilities.filter(c => c.canDo);
    const cantDo = ld.capabilities.filter(c => !c.canDo);
    return `
<div class="demo-box">
  <div class="compare-box">
    <div class="compare-item compare-after">
      <strong>✓</strong>
      <ul>${canDo.map(c => `<li><strong>${escapeHtml(c.title)}</strong> — ${escapeHtml(c.description)}</li>`).join('\n')}</ul>
    </div>
    <div class="compare-item compare-before">
      <strong>✗</strong>
      <ul>${cantDo.map(c => `<li><strong>${escapeHtml(c.title)}</strong> — ${escapeHtml(c.description)}</li>`).join('\n')}</ul>
    </div>
  </div>
</div>
`;
  });

  // ============================================================
  // JailbreakDemo - Show attack/defense examples
  // ============================================================
  result = result.replace(/<JailbreakDemo\s*\/>/g, () => {
    const examplesHtml = ld.jailbreakExamples.slice(0, 3).map(ex => `
      <div class="jailbreak-example">
        <div class="jailbreak-name"><strong>${escapeHtml(ex.name)}</strong> — ${escapeHtml(ex.description)}</div>
        <div class="compare-box">
          <div class="compare-item compare-after"><strong>${icon('shield', '🛡️')}</strong><br/>${escapeHtml(ex.systemPrompt)}</div>
          <div class="compare-item compare-before"><strong>${icon('warning', '⚠️')}</strong><br/>${escapeHtml(ex.attack)}</div>
        </div>
      </div>
    `).join('');
    return `
<div class="demo-box">
  ${examplesHtml}
</div>
`;
  });

  // ============================================================
  // Framework demos - CRISPE, BREAK, RTF with steps and example
  // ============================================================
  const fwColors = ['#dbeafe', '#dcfce7', '#f3e8ff', '#fef3c7', '#fce7f3', '#cffafe'];
  const fwBorderColors = ['#93c5fd', '#86efac', '#c4b5fd', '#fcd34d', '#f9a8d4', '#67e8f9'];

  const fwMap: Record<string, keyof typeof ld.frameworks> = {
    CRISPEFramework: 'crispe',
    BREAKFramework: 'break',
    RTFFramework: 'rtf',
  };

  for (const [comp, fwKey] of Object.entries(fwMap)) {
    const regex = new RegExp(`<${comp}\\s*/>`, 'g');
    result = result.replace(regex, () => {
      const fw = ld.frameworks[fwKey];
      const stepsHtml = fw.steps.map((s, i) => `
        <div class="fw-step">
          <div class="fw-letter" style="background:${fwColors[i % fwColors.length]};border:1px solid ${fwBorderColors[i % fwBorderColors.length]};">${s.letter}</div>
          <div class="fw-step-body">
            <div class="fw-step-label"><strong>${escapeHtml(s.label)}</strong> — ${escapeHtml(s.description)}</div>
            ${s.example ? `<div class="fw-step-example">${escapeHtml(s.example)}</div>` : ''}
          </div>
        </div>
      `).join('\n');
      return `
<div class="demo-box">
  <div class="demo-header">${escapeHtml(fw.name)}</div>
  ${stepsHtml}
  <div class="demo-section"><strong>${labels.completePrompt}:</strong></div>
  <pre class="prompt-code">${protectCodeBlock(escapeHtml(fw.examplePrompt))}</pre>
</div>
`;
    });
  }

  // ============================================================
  // PrinciplesSummary - Numbered principles list (from locale data)
  // ============================================================
  result = result.replace(/<PrinciplesSummary\s*\/>/g, () => {
    const iconMap: Record<string, [string, string]> = {
      Gem: ['gem', '💎'], Target: ['target', '🎯'], Crown: ['crown', '👑'], Compass: ['compass', '🧭'],
      RefreshCw: ['refresh', '🔄'], Sparkles: ['sparkles', '✨'], Ruler: ['ruler', '📏'], CheckCircle: ['check', '✅'],
    };
    const itemsHtml = ld.principles.map(p => {
      const ic = iconMap[p.iconName] || ['info', '•'];
      return `<div class="principle-item"><span class="principle-icon">${icon(ic[0], ic[1])}</span><span><strong>${escapeHtml(p.title)}</strong> — ${escapeHtml(p.description)}</span></div>`;
    }).join('\n');
    return `
<div class="demo-box">
  ${itemsHtml}
</div>
`;
  });

  // ============================================================
  // VersionDiff - Show versions with printable diff
  // ============================================================
  result = result.replace(/<VersionDiff\s+versions=\{\[([\s\S]*?)\]\}\s*\/>/g, (match, inner) => {
    // Parse versions: { label: "...", content: `...`, note: "..." }
    const versions: { label: string; content: string; note: string }[] = [];
    const versionBlocks = inner.split(/\},\s*\{/).map((b: string) => b.replace(/^\{|\}$/g, ''));

    for (const block of versionBlocks) {
      const labelMatch = block.match(/label:\s*"([^"]*?)"/);
      const noteMatch = block.match(/note:\s*"([^"]*?)"/);
      // content can be quoted or template-literal
      const contentQuoted = block.match(/content:\s*"([^"]*?)"/);
      const contentBt = block.match(/content:\s*`([\s\S]*?)`/);
      const content = contentBt ? contentBt[1] : (contentQuoted ? contentQuoted[1] : '');
      if (labelMatch) {
        versions.push({ label: labelMatch[1], content, note: noteMatch ? noteMatch[1] : '' });
      }
    }

    if (versions.length === 0) return '';

    const versionsHtml = versions.map((v, i) => `
      <div class="version-block">
        <div class="version-header">
          <span class="version-label">${escapeHtml(v.label)}</span>
          ${v.note ? `<span class="version-note">${escapeHtml(v.note)}</span>` : ''}
        </div>
        <pre class="prompt-code">${protectCodeBlock(escapeHtml(v.content))}</pre>
      </div>
    `).join('\n');

    return `
<div class="demo-box">
  <div class="demo-header">Prompt Evolution</div>
  ${versionsHtml}
</div>
`;
  });

  // ============================================================
  // ChainExample - Full chain with prompts and outputs per type
  // ============================================================
  result = result.replace(/<ChainExample\s*\n?\s*type="(\w+)"\s*\n?\s*steps=\{\[([\s\S]*?)\]\}\s*\n?\s*\/>/g, (match, type, stepsInner) => {
    // Parse steps: { step: "...", prompt: "...", output: "..." }
    const steps: { step: string; prompt: string; output: string }[] = [];
    const stepRegex = /\{\s*step:\s*"([^"]*?)"\s*,\s*prompt:\s*"([^"]*?)"\s*,\s*output:\s*(?:'([^']*?)'|"([^"]*?)")/g;
    let sm;
    while ((sm = stepRegex.exec(stepsInner)) !== null) {
      steps.push({ step: sm[1], prompt: sm[2], output: sm[3] || sm[4] || '' });
    }

    // If regex didn't match (complex multiline prompts), try a simpler approach
    if (steps.length === 0) {
      const blockRegex = /\{\s*step:\s*"([^"]*?)"/g;
      let bm;
      while ((bm = blockRegex.exec(stepsInner)) !== null) {
        steps.push({ step: bm[1], prompt: '', output: '' });
      }
    }

    const typeLabels: Record<string, string> = {
      sequential: 'Sequential Chain',
      parallel: 'Parallel Chain',
      conditional: 'Conditional Chain',
      iterative: 'Iterative Chain',
    };

    const typeIcons: Record<string, string> = {
      sequential: '→',
      parallel: '⇉',
      conditional: '◇',
      iterative: '↻',
    };

    const stepsHtml = steps.map((s, i) => {
      const isSkipped = s.step.toLowerCase().includes('skipped');
      const stepClass = isSkipped ? 'chain-step-skipped' : 'chain-step-item';
      const connector = type === 'parallel' && i > 0 && i < steps.length - 1
        ? 'chain-connector-parallel'
        : i < steps.length - 1 ? 'chain-connector' : '';

      return `
<div class="${stepClass}">
  <div class="chain-step-num">${isSkipped ? '✗' : (i + 1)}</div>
  <div class="chain-step-body">
    <div class="chain-step-name">${escapeHtml(s.step)}</div>
    ${!isSkipped && s.prompt ? `<div class="chain-step-prompt"><span class="chain-label">Prompt:</span> ${protectCodeBlock(escapeHtml(s.prompt))}</div>` : ''}
    ${!isSkipped && s.output ? `<div class="chain-step-output"><span class="chain-label">Output:</span> ${protectCodeBlock(escapeHtml(s.output))}</div>` : ''}
    ${isSkipped ? '<div class="chain-step-skipped-note">Skipped — condition not met</div>' : ''}
  </div>
</div>${connector ? `<div class="${connector}"></div>` : ''}`;
    }).join('\n');

    const loopNote = type === 'iterative' ? '<div class="chain-loop-note">↻ Loop until quality threshold is met</div>' : '';

    return `
<div class="chain-box chain-${type}">
  <div class="chain-box-header">${typeIcons[type] || '→'} ${typeLabels[type] || type}</div>
  ${stepsHtml}
  ${loopNote}
</div>
`;
  });

  // ============================================================
  // TextToImageDemo - Show prompt anatomy with all categories
  // ============================================================
  result = result.replace(/<TextToImageDemo\s*\/>/g, () => {
    const imgOpts = ld.imagePromptOptions;
    const imgLabels = ld.imageCategoryLabels;
    const catColors: Record<string, string> = { subject: '#dbeafe', style: '#f3e8ff', lighting: '#fef3c7', composition: '#dcfce7', mood: '#fce7f3' };
    const categories = Object.keys(imgOpts).map(key => ({
      label: imgLabels[key] || key,
      options: imgOpts[key],
      color: catColors[key] || '#f5f5f4',
    }));

    const categoriesHtml = categories.map(cat => {
      const optionsHtml = cat.options.map((opt, i) => {
        const style = i === 0 ? ` style="background:${cat.color};border:1px solid #ccc;font-weight:600;"` : '';
        return `<span class="image-option"${style}>${opt}</span>`;
      }).join(' ');
      return `<div class="image-category"><span class="image-cat-label" style="color:#555;">${cat.label}:</span> ${optionsHtml}</div>`;
    }).join('\n');

    const examplePrompts = [
      { prompt: 'a cat, photorealistic, golden hour, close-up portrait, peaceful', note: 'Realistic pet photography feel' },
      { prompt: 'a castle, oil painting, dramatic shadows, wide landscape, mysterious', note: 'Dark fantasy atmosphere' },
      { prompt: 'an astronaut, 3D render, neon glow, symmetrical, energetic', note: 'Sci-fi poster style' },
    ];

    const examplesHtml = examplePrompts.map(ex => `
      <div class="image-example">
        <pre class="prompt-code">${protectCodeBlock(escapeHtml(ex.prompt))}</pre>
        <p class="demo-note">${ex.note}</p>
      </div>
    `).join('');

    const diffusionSteps = [
      '1. Parse prompt → identify subject, style, and modifiers',
      '2. Start with random noise (pure static)',
      '3. Denoise step 1 → rough shapes emerge',
      '4. Denoise step 2 → details and colors form',
      '5. Denoise step 3 → final refinement and sharpness',
    ];

    return `
<div class="demo-box">
  <div class="demo-header">${icon('palette', '🎨')} ${t(msg, 'book.interactive.textToImageBuildPrompt') || 'Text-to-Image: Building an Image Prompt'}</div>
  <p class="demo-note">Image generation prompts combine categories. Select one option from each row to build a complete prompt:</p>
  ${categoriesHtml}
  <div class="demo-section"><strong>Example prompts built from these categories:</strong></div>
  ${examplesHtml}
  <div class="demo-section"><strong>How Diffusion Models Work:</strong></div>
  <div class="diffusion-steps">
    ${diffusionSteps.map(s => `<div class="diffusion-step">${s}</div>`).join('\n')}
  </div>
  <p class="demo-note">The model starts with random noise and gradually removes it, guided by your text prompt, until a coherent image forms. More specific prompts give the model stronger guidance at each step.</p>
</div>
`;
  });

  // ============================================================
  // TextToVideoDemo - Show prompt anatomy for video
  // ============================================================
  result = result.replace(/<TextToVideoDemo\s*\/>/g, () => {
    const vidOpts = ld.videoPromptOptions;
    const vidLabels = ld.videoCategoryLabels;
    const vidColors: Record<string, string> = { subject: '#dbeafe', action: '#dcfce7', camera: '#f3e8ff', duration: '#fef3c7' };
    const categories = Object.keys(vidOpts).map(key => ({
      label: vidLabels[key] || key,
      options: vidOpts[key],
      color: vidColors[key] || '#f5f5f4',
    }));

    const categoriesHtml = categories.map(cat => {
      const optionsHtml = cat.options.map((opt, i) => {
        const style = i === 0 ? ` style="background:${cat.color};border:1px solid #ccc;font-weight:600;"` : '';
        return `<span class="image-option"${style}>${opt}</span>`;
      }).join(' ');
      return `<div class="image-category"><span class="image-cat-label" style="color:#555;">${cat.label}:</span> ${optionsHtml}</div>`;
    }).join('\n');

    const examplePrompts = [
      { prompt: 'A bird takes flight, slow pan left, 4 seconds', note: 'Nature documentary style' },
      { prompt: 'A wave crashes on rocks, static shot, 6 seconds', note: 'Dramatic landscape footage' },
      { prompt: 'A flower blooms in timelapse, dolly zoom, 8 seconds', note: 'Macro nature timelapse' },
    ];

    const examplesHtml = examplePrompts.map(ex => `
      <div class="image-example">
        <pre class="prompt-code">${protectCodeBlock(escapeHtml(ex.prompt))}</pre>
        <p class="demo-note">${ex.note}</p>
      </div>
    `).join('');

    return `
<div class="demo-box">
  <div class="demo-header">${icon('video', '🎬')} ${t(msg, 'book.interactive.textToVideoBuildPrompt') || 'Text-to-Video: Building a Video Prompt'}</div>
  <p class="demo-note">Video prompts need subject, action, camera movement, and duration. Select one from each row:</p>
  ${categoriesHtml}
  <div class="demo-section"><strong>Example prompts:</strong></div>
  ${examplesHtml}
  <div class="demo-section"><strong>Key challenges for video models:</strong></div>
  <ul style="font-size:9pt;margin:0.5em 0 0.5em 1.5em;">
    <li><strong>Temporal consistency</strong> — keeping the subject looking the same across frames</li>
    <li><strong>Natural motion</strong> — realistic movement physics and speed</li>
    <li><strong>Camera coherence</strong> — smooth, intentional camera movement</li>
  </ul>
</div>
`;
  });

  // ============================================================
  // PromptBreakdown - Color-labeled prompt segments
  // ============================================================
  result = result.replace(/<PromptBreakdown\s+parts=\{\[([\s\S]*?)\]\}\s*\/>/g, (match, inner) => {
    const colorValues: Record<string, string> = {
      blue: '#dbeafe', green: '#dcfce7', purple: '#f3e8ff',
      amber: '#fef3c7', pink: '#fce7f3', cyan: '#cffafe',
    };
    const borderColors: Record<string, string> = {
      blue: '#93c5fd', green: '#86efac', purple: '#c4b5fd',
      amber: '#fcd34d', pink: '#f9a8d4', cyan: '#67e8f9',
    };
    const defaultColorOrder = ['blue', 'green', 'purple', 'amber', 'pink', 'cyan'];

    // Parse parts
    const parts: { label: string; text: string; color: string }[] = [];
    const partRegex = /\{\s*label:\s*"([^"]*?)"\s*,\s*text:\s*"([^"]*?)"(?:\s*,\s*color:\s*"([^"]*?)")?\s*\}/g;
    let pm;
    while ((pm = partRegex.exec(inner)) !== null) {
      parts.push({ label: pm[1], text: pm[2], color: pm[3] || defaultColorOrder[parts.length % defaultColorOrder.length] });
    }

    if (parts.length === 0) return '';

    const segmentsHtml = parts.map(p => {
      const bg = colorValues[p.color] || colorValues.blue;
      const border = borderColors[p.color] || borderColors.blue;
      return `<span class="pb-segment"><span class="pb-label" style="color:${border};">${escapeHtml(p.label)}</span><span class="pb-text" style="border-bottom:2px solid ${border};background:${bg};">${escapeHtml(p.text)}</span></span>`;
    }).join(' ');

    return `
<div class="prompt-breakdown">
  ${segmentsHtml}
</div>
`;
  });

  // ============================================================
  // SpecificitySpectrum - Show all levels from vague to specific
  // ============================================================
  result = result.replace(/<SpecificitySpectrum\s+levels=\{\[([\s\S]*?)\]\}\s*\/>/g, (match, inner) => {
    const levels: { level: string; text: string }[] = [];
    const levelRegex = /\{\s*level:\s*"([^"]*?)"\s*,\s*text:\s*"([^"]*?)"\s*\}/g;
    let lm;
    while ((lm = levelRegex.exec(inner)) !== null) {
      levels.push({ level: lm[1], text: lm[2] });
    }

    if (levels.length === 0) return '';

    const barColors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e'];
    const levelsHtml = levels.map((l, i) => {
      const width = ((i + 1) / levels.length * 100).toFixed(0);
      const color = barColors[i] || barColors[barColors.length - 1];
      return `
<div class="spectrum-level">
  <div class="spectrum-header">
    <span class="spectrum-badge" style="background:${color};color:white;">${escapeHtml(l.level)}</span>
    <span class="spectrum-bar-wrap"><span class="spectrum-bar" style="width:${width}%;background:${color};"></span></span>
  </div>
  <pre class="prompt-code">${protectCodeBlock(escapeHtml(l.text))}</pre>
</div>`;
    }).join('\n');

    return `
<div class="demo-box">
  <div class="demo-header">Specificity Spectrum</div>
  ${levelsHtml}
</div>
`;
  });

  // ============================================================
  // ChainFlowDemo - Static overview of all 4 chain types
  // ============================================================
  result = result.replace(/<ChainFlowDemo\s*\/>/g, () => {
    const ct = ld.chainTypes;
    const seq = ct.find(c => c.id === 'sequential') || ct[0];
    const par = ct.find(c => c.id === 'parallel') || ct[1];
    const cond = ct.find(c => c.id === 'conditional') || ct[2];
    const iter = ct.find(c => c.id === 'iterative') || ct[3];
    return `
<div class="demo-box">
  <div class="chain-types-grid">
    <div class="chain-type-card">
      <div class="chain-type-name" style="color:#2563eb;">${escapeHtml(seq.name)}</div>
      <div class="chain-type-desc">${escapeHtml(seq.description)}</div>
      <div class="chain-type-diagram">
        <span class="chain-type-step" style="background:#dbeafe;border-color:#93c5fd;">Extract</span>
        <span class="chain-type-arrow">→</span>
        <span class="chain-type-step" style="background:#dbeafe;border-color:#93c5fd;">Analyze</span>
        <span class="chain-type-arrow">→</span>
        <span class="chain-type-step" style="background:#dbeafe;border-color:#93c5fd;">Generate</span>
      </div>
    </div>
    <div class="chain-type-card">
      <div class="chain-type-name" style="color:#7c3aed;">${escapeHtml(par.name)}</div>
      <div class="chain-type-desc">${escapeHtml(par.description)}</div>
      <div class="chain-type-diagram chain-type-diagram-parallel">
        <div style="text-align:center;"><span class="chain-type-step" style="background:#f3e8ff;border-color:#c4b5fd;">Input</span></div>
        <div class="chain-type-arrow">↓</div>
        <div style="display:flex;justify-content:center;gap:0.3em;">
          <span class="chain-type-step" style="background:#f3e8ff;border-color:#c4b5fd;">Sentiment</span>
          <span class="chain-type-step" style="background:#f3e8ff;border-color:#c4b5fd;">Entities</span>
          <span class="chain-type-step" style="background:#f3e8ff;border-color:#c4b5fd;">Topics</span>
        </div>
        <div class="chain-type-arrow">↓</div>
        <div style="text-align:center;"><span class="chain-type-step" style="background:#f3e8ff;border-color:#c4b5fd;">Merge</span></div>
      </div>
    </div>
    <div class="chain-type-card">
      <div class="chain-type-name" style="color:#d97706;">${escapeHtml(cond.name)}</div>
      <div class="chain-type-desc">${escapeHtml(cond.description)}</div>
      <div class="chain-type-diagram chain-type-diagram-parallel">
        <div style="text-align:center;"><span class="chain-type-step" style="background:#fef3c7;border-color:#fcd34d;">Classify</span></div>
        <div style="display:flex;justify-content:center;gap:1em;">
          <div style="text-align:center;"><div class="chain-type-arrow">↙</div><span class="chain-type-step" style="background:#fef3c7;border-color:#fcd34d;">If complaint</span></div>
          <div style="text-align:center;"><div class="chain-type-arrow">↘</div><span class="chain-type-step" style="background:#fef3c7;border-color:#fcd34d;">If question</span></div>
        </div>
      </div>
    </div>
    <div class="chain-type-card">
      <div class="chain-type-name" style="color:#16a34a;">${escapeHtml(iter.name)}</div>
      <div class="chain-type-desc">${escapeHtml(iter.description)}</div>
      <div class="chain-type-diagram">
        <span class="chain-type-step" style="background:#dcfce7;border-color:#86efac;">Generate</span>
        <span class="chain-type-arrow">→</span>
        <span class="chain-type-step" style="background:#dcfce7;border-color:#86efac;">Evaluate</span>
        <span class="chain-type-arrow">→</span>
        <span class="chain-type-step" style="background:#dcfce7;border-color:#86efac;">Refine</span>
        <span class="chain-type-arrow" style="font-size:10pt;">↻</span>
      </div>
    </div>
  </div>
</div>
`;
  });

  // ============================================================
  // CodeEditor - Static code block with filename header
  // ============================================================
  result = result.replace(/<CodeEditor\s*\n?\s*([\s\S]*?)\/>/g, (match, attrs) => {
    const props = extractProps(match);
    const lang = props.language || '';
    const filename = props.filename || '';
    // Extract code from code={`...`}
    const codeMatch = match.match(/code=\{`([\s\S]*?)`\}/);
    const code = codeMatch ? codeMatch[1] : '';
    if (!code) return '';
    return `
<div class="code-editor-box">
  <div class="code-editor-header">
    <span class="code-editor-dots"><span style="background:#ff5f56;"></span><span style="background:#ffbd2e;"></span><span style="background:#27c93f;"></span></span>
    ${filename ? `<span class="code-editor-filename">${escapeHtml(filename)}</span>` : ''}
    <span class="code-editor-lang">${escapeHtml(lang)}</span>
  </div>
  <pre class="prompt-code">${protectCodeBlock(escapeHtml(code))}</pre>
</div>
`;
  });

  // ============================================================
  // ChainErrorDemo - Show all 3 scenarios statically
  // ============================================================
  result = result.replace(/<ChainErrorDemo\s*\/>/g, () => {
    const scenarios = ld.scenarios;
    const steps = ld.steps;
    const stepsStr = steps.map(s => escapeHtml(s.name)).join(' → ');
    return `
<div class="demo-box">
  <div class="chain-types-grid">
    ${scenarios.map(sc => `
    <div class="chain-type-card">
      <div class="chain-type-name">${escapeHtml(sc.name)}</div>
      <div class="chain-type-desc">${escapeHtml(sc.description)}</div>
      <div style="font-size:8pt;font-family:var(--font-mono);color:#666;">${stepsStr}</div>
    </div>`).join('\n')}
  </div>
</div>
`;
  });

  // ============================================================
  // ValidationDemo - Show validation flow
  // ============================================================
  result = result.replace(/<ValidationDemo\s*\/>/g, () => {
    const vd = ld.validationDemo;
    return `
<div class="demo-box">
  <div class="demo-header">${escapeHtml(vd.title)}</div>
  <div class="chain-types-grid">
    <div class="chain-type-card">
      <div class="chain-type-name" style="color:#d97706;">${escapeHtml(vd.invalidRetry)}</div>
      <div style="font-size:8pt;font-family:var(--font-mono);margin-top:0.4em;">
        ${vd.steps.map((s, i) => `${i + 1}. ${escapeHtml(s.name)}`).join('<br/>')}
        <br/>✗ ${escapeHtml(vd.outputs.ageMustBeNumber)}<br/>↻ ${escapeHtml(vd.outputs.retryingWithFeedback)}<br/>✓ ${escapeHtml(vd.outputs.allFieldsValid)}<br/>✓ ${escapeHtml(vd.outputs.dataProcessedSuccessfully)}
      </div>
    </div>
    <div class="chain-type-card">
      <div class="chain-type-name" style="color:#16a34a;">${escapeHtml(vd.validData)}</div>
      <div style="font-size:8pt;font-family:var(--font-mono);margin-top:0.4em;">
        ${vd.steps.map((s, i) => `${i + 1}. ${escapeHtml(s.name)}`).join('<br/>')}
        <br/>✓ ${escapeHtml(vd.outputs.allFieldsValid)}<br/>✓ ${escapeHtml(vd.outputs.dataProcessedSuccessfully)}
      </div>
    </div>
  </div>
</div>
`;
  });

  // ============================================================
  // FallbackDemo - Show primary vs fallback paths
  // ============================================================
  result = result.replace(/<FallbackDemo\s*\/>/g, () => {
    const fd = ld.fallbackDemo;
    return `
<div class="demo-box">
  <div class="demo-header">${escapeHtml(fd.title)}</div>
  <div class="chain-types-grid">
    <div class="chain-type-card">
      <div class="chain-type-name" style="color:#16a34a;">${escapeHtml(fd.primarySucceeds)}</div>
      <div style="font-size:8pt;font-family:var(--font-mono);margin-top:0.4em;">
        ${escapeHtml(fd.steps[0].name)} → ✓<br/>
        ${escapeHtml(fd.outputs.deepAnalysisComplete)}<br/>
        ${escapeHtml(fd.outputs.resultFromPrimary)}
      </div>
    </div>
    <div class="chain-type-card">
      <div class="chain-type-name" style="color:#7c3aed;">${escapeHtml(fd.useFallback)}</div>
      <div style="font-size:8pt;font-family:var(--font-mono);margin-top:0.4em;">
        ${escapeHtml(fd.steps[0].name)} → ✗<br/>
        ${escapeHtml(fd.steps[1].name)} → ✓<br/>
        ${escapeHtml(fd.outputs.resultFromFallback)}
      </div>
    </div>
  </div>
</div>
`;
  });

  // ============================================================
  // ContentPipelineDemo - Show pipeline steps with prompts
  // ============================================================
  result = result.replace(/<ContentPipelineDemo\s*\/>/g, () => {
    const cpd = ld.contentPipelineDemo;
    const stepsHtml = cpd.steps.map((s, i) => {
      const prompt = cpd.prompts[s.id] || '';
      const outputKey = s.id as keyof typeof cpd.outputs;
      const output = cpd.outputs[outputKey] || '';
      return `
      <div class="chain-step-item">
        <div class="chain-step-num">${i + 1}</div>
        <div class="chain-step-body">
          <div class="chain-step-name">${escapeHtml(s.name)}</div>
          ${prompt && s.id !== 'input' ? `<div class="chain-step-prompt"><span class="chain-label">${labels.prompt}:</span> ${protectCodeBlock(escapeHtml(prompt))}</div>` : ''}
          ${output ? `<div class="chain-step-output"><span class="chain-label">${labels.output}:</span> ${escapeHtml(output)}</div>` : ''}
        </div>
      </div>${i < cpd.steps.length - 1 ? '<div class="chain-connector"></div>' : ''}`;
    }).join('\n');
    return `
<div class="chain-box chain-sequential">
  <div class="chain-box-header">→ ${escapeHtml(cpd.title)}</div>
  ${stepsHtml}
</div>
`;
  });

  // ============================================================
  // SummarizationDemo - Show all 4 strategies
  // ============================================================
  result = result.replace(/<SummarizationDemo\s*\/>/g, () => {
    const html = ld.strategies.map(s => `
      <div class="chain-type-card">
        <div class="chain-type-name">${escapeHtml(s.name)}</div>
        <div class="chain-type-desc">${escapeHtml(s.description)}</div>
        ${s.summary ? `<div style="font-size:8pt;font-family:var(--font-mono);color:#666;margin-top:0.3em;">${escapeHtml(s.summary)}</div>` : ''}
      </div>
    `).join('');
    return `
<div class="demo-box">
  <div class="chain-types-grid">${html}</div>
</div>
`;
  });

  // ============================================================
  // ContextPlayground - Show context blocks with token counts
  // ============================================================
  result = result.replace(/<ContextPlayground\s*\/>/g, () => {
    const blocks = ld.contextBlocks;
    const total = blocks.filter(b => b.enabled).reduce((s, b) => s + b.tokens, 0);
    const html = blocks.map(b => `
      <div class="context-block ${b.enabled ? 'context-block-on' : 'context-block-off'}">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.2em;">
          <span style="font-weight:600;">${b.enabled ? '✓' : '○'} ${escapeHtml(b.label)}</span>
          <span style="color:#78716c;">${b.tokens} tokens</span>
        </div>
        <div style="font-family:var(--font-mono);font-size:7.5pt;color:#78716c;">${escapeHtml(b.content)}</div>
      </div>
    `).join('');
    return `
<div class="demo-box">
  <div class="demo-header">Context — ${total} / 200 tokens</div>
  ${html}
</div>
`;
  });

  // ============================================================
  // PromptBuilder - Static template with writable fields
  // ============================================================
  result = result.replace(/<PromptBuilder\s*[^>]*\/>/g, (match) => {
    const props = extractProps(match);
    const title = props.title || 'Prompt Builder';
    const fields = ld.builderFields.map(f => ({
      label: f.label,
      placeholder: f.placeholder,
      hint: f.hint,
      required: f.required || false,
    }));
    const fieldsHtml = fields.map(f => `
      <div class="builder-field">
        <div class="builder-field-label">${f.label}${f.required ? ' *' : ''}</div>
        <div class="builder-field-hint">${f.hint}</div>
        <div class="builder-field-input">${escapeHtml(f.placeholder)}</div>
      </div>
    `).join('');
    return `
<div class="demo-box">
  <div class="demo-header">${icon('pencil', '✏️')} ${escapeHtml(title)}</div>
  <p class="demo-note">Fill in the fields below to construct your prompt. Not all fields are required — use what fits your task.</p>
  ${fieldsHtml}
</div>
`;
  });

  // ============================================================
  // HarnessDemo - default trace plus the unavailable-tools outcome
  // ============================================================
  result = result.replace(/<HarnessDemo\s+copy=\{\{([\s\S]*?)\}\}\s*\/>/g, (_match, copy: string) => {
    const header = extractObjectStringFields(copy.split('controls:')[0]);
    const stepsSource = copy.split('steps:')[1] || '';
    const step = (key: string) => extractObjectStringFields(stepsSource.match(new RegExp(`${key}:\\s*\\{([^{}]*)\\}`))?.[1] || '');
    const trace = [
      { data: step('context'), keys: ['clearPrompt', 'skillLoaded'] },
      { data: step('request'), keys: ['guided'] },
      { data: step('permission'), keys: ['allowed'] },
      { data: step('observation'), keys: ['guided'] },
      { data: step('review'), keys: ['checked'] },
      { data: step('finish'), keys: ['verified'] },
    ];
    const traceHtml = trace.map(({ data, keys }) => `<li><strong>${escapeHtml(data.title || '')}</strong>${keys.map(key => `<p>${escapeHtml(data[key] || '')}</p>`).join('')}</li>`).join('\n');
    return `
<div class="demo-box">
  <div class="demo-header">${escapeHtml(header.title || '')}</div>
  <p class="demo-note">${escapeHtml(header.description || '')}</p>
  <p><strong>${escapeHtml(header.taskLabel || '')}:</strong> ${escapeHtml(header.task || '')}</p>
  <p>${escapeHtml(header.resetHint || '')}</p>
  <ol>${traceHtml}</ol>
  <p><strong>${escapeHtml(header.unverified || '')}:</strong> ${escapeHtml(step('permission').blocked || '')} ${escapeHtml(step('finish').unverified || '')}</p>
  <p class="interactive-notice">${notice}</p>
</div>
`;
  });

  // ============================================================
  // ToolsDemo - both routes and the read/write permission outcomes
  // ============================================================
  result = result.replace(/<ToolsDemo\s+copy=\{\{([\s\S]*?)\}\}\s*\/>/g, (_match, copy: string) => {
    const data = extractObjectStringFields(copy.split('states:')[0]);
    const states = extractObjectStringFields(copy.split('states:')[1] || '');
    const route = (keys: string[]) => keys.map(key => escapeHtml(data[key] || '')).join(' → ');
    const readRequest = protectCodeBlock(escapeHtml(`search_issues(${JSON.stringify({ query: data.query })})`));
    const writeRequest = protectCodeBlock(escapeHtml(`create_issue(${JSON.stringify({ title: data.issueTitle })})`));
    const outcomes = [
      { state: 'disconnected', label: 'disconnectedLabel' },
      { state: 'denied', label: 'readOnlyLabel' },
      { state: 'approval', label: 'readWriteLabel' },
      { state: 'created', label: 'approve' },
      { state: 'declined', label: 'decline' },
    ];
    return `
<div class="demo-box">
  <div class="demo-header">${escapeHtml(data.title || '')}</div>
  <p class="demo-note">${escapeHtml(data.description || '')}</p>
  <p><strong>${escapeHtml(data.directLabel || '')}:</strong> ${route(['appLabel', 'connectorLabel', 'serviceLabel'])}</p>
  <p><strong>${escapeHtml(data.mcpLabel || '')}:</strong> ${route(['hostLabel', 'serverLabel', 'serviceLabel'])}</p>
  <p><strong>${escapeHtml(data.requestLabel || '')}:</strong> ${escapeHtml(data.readLabel || '')}</p>
  <pre class="prompt-code">${readRequest}</pre>
  <p>${escapeHtml(states.read || '')}</p>
  <p><strong>${escapeHtml(data.requestLabel || '')}:</strong> ${escapeHtml(data.writeLabel || '')}</p>
  <pre class="prompt-code">${writeRequest}</pre>
  <ul>${outcomes.map(({ state, label }) => `<li><strong>${escapeHtml(data[label] || '')}:</strong> ${escapeHtml(states[state] || '')}</li>`).join('')}</ul>
  <p>${escapeHtml(data.policyNote || '')}</p>
  <p class="interactive-notice">${notice}</p>
</div>
`;
  });

  // ============================================================
  // FrameworkDemo (generic, with props) — fallback
  // ============================================================
  const simpleStaticDemos: string[] = [];

  for (const component of simpleStaticDemos) {
    const selfClosingRegex = new RegExp(`<${component}\\s*[^>]*/>`, 'g');
    result = result.replace(selfClosingRegex, `<p class="interactive-notice">${notice}</p>`);
    const withContentRegex = new RegExp(`<${component}[^>]*>[\\s\\S]*?</${component}>`, 'g');
    result = result.replace(withContentRegex, `<p class="interactive-notice">${notice}</p>`);
  }

  // ============================================================
  // Truly interactive-only components → notice
  // ============================================================
  for (const component of INTERACTIVE_ONLY_COMPONENTS) {
    const selfClosingRegex = new RegExp(`<${component}\\s*[^>]*/>`, 'g');
    result = result.replace(selfClosingRegex, `<p class="interactive-notice">${notice}</p>`);
    const withContentRegex = new RegExp(`<${component}[^>]*>[\\s\\S]*?</${component}>`, 'g');
    result = result.replace(withContentRegex, `<p class="interactive-notice">${notice}</p>`);
  }

  // ============================================================
  // Collapsible - render open
  // ============================================================
  result = result.replace(/<Collapsible\s+([\s\S]*?)>([\s\S]*?)<\/Collapsible>/g, (match, attrs, children) => {
    const props = extractProps(attrs);
    const title = props.title || '';
    return `
<div class="callout callout-info">
  <div class="callout-header">${escapeHtml(title)}</div>
  <div class="callout-content">${children}</div>
</div>
`;
  });

  // ============================================================
  // Multi-Agent Systems diagram
  // ============================================================
  result = result.replace(/<div className="my-6 p-6 bg-muted\/30 rounded-lg">\s*<div className="flex flex-col md:flex-row items-center justify-center gap-6">[\s\S]*?Coordinator[\s\S]*?Coder[\s\S]*?<\/div>\s*<\/div>/g, () => {
    return `
<div class="demo-box" style="text-align:center;page-break-inside:avoid;">
  <div class="demo-header">Multi-Agent System</div>
  <div style="display:flex;align-items:center;justify-content:center;gap:1.5em;flex-wrap:wrap;margin:1em 0;">
    <div style="padding:0.6em 1.2em;border:2px solid #999;border-radius:8px;font-family:var(--font-sans);font-weight:700;font-size:10pt;">
      Coordinator<br/><span style="font-size:7pt;font-weight:400;color:#666;">Manages workflow</span>
    </div>
    <div style="font-size:16pt;color:#999;">&#x27F7;</div>
    <div style="display:flex;gap:0.6em;flex-wrap:wrap;justify-content:center;">
      <div style="padding:0.4em 0.8em;border:1px solid #ccc;border-radius:6px;font-family:var(--font-sans);font-size:8.5pt;font-weight:500;">Researcher</div>
      <div style="padding:0.4em 0.8em;border:1px solid #ccc;border-radius:6px;font-family:var(--font-sans);font-size:8.5pt;font-weight:500;">Writer</div>
      <div style="padding:0.4em 0.8em;border:1px solid #ccc;border-radius:6px;font-family:var(--font-sans);font-size:8.5pt;font-weight:500;">Critic</div>
      <div style="padding:0.4em 0.8em;border:1px solid #ccc;border-radius:6px;font-family:var(--font-sans);font-size:8.5pt;font-weight:500;">Coder</div>
    </div>
  </div>
  <p class="demo-note">Each agent has its own system prompt. The coordinator orchestrates their collaboration through structured messages.</p>
</div>
`;
  });

  // ============================================================
  // Prompt Orchestration pipeline diagram
  // ============================================================
  result = result.replace(/<div className="my-6 flex flex-col items-center gap-2 p-6 bg-muted\/30 rounded-lg">\s*<div className="px-6 py-3 bg-slate[\s\S]*?User Request[\s\S]*?Final Output[\s\S]*?<\/div>\s*<\/div>/g, () => {
    const steps = [
      { name: 'User Request', desc: '' },
      { name: 'Planner Agent', desc: 'Breaks down task' },
      { name: 'Researcher Agent', desc: 'Gathers information' },
      { name: 'Writer Agent', desc: 'Creates content' },
      { name: 'Reviewer Agent', desc: 'Quality checks' },
      { name: 'Final Output', desc: '' },
    ];
    const stepsHtml = steps.map((s, i) => {
      const isEndpoint = i === 0 || i === steps.length - 1;
      const border = isEndpoint ? '2px solid #999' : '1px solid #ccc';
      const weight = isEndpoint ? '700' : '600';
      const arrow = i < steps.length - 1 ? '<div style="font-size:12pt;color:#999;margin:0.15em 0;">↓</div>' : '';
      return `
        <div style="padding:0.5em 1.5em;border:${border};border-radius:6px;font-family:var(--font-sans);font-size:9pt;font-weight:${weight};text-align:center;">
          ${s.name}${s.desc ? `<br/><span style="font-size:7pt;font-weight:400;color:#666;">${s.desc}</span>` : ''}
        </div>
        ${arrow}`;
    }).join('\n');
    return `
<div class="demo-box" style="page-break-inside:avoid;">
  <div class="demo-header">Prompt Orchestration Pipeline</div>
  <div style="display:flex;flex-direction:column;align-items:center;margin:0.8em 0;">
    ${stepsHtml}
  </div>
</div>
`;
  });

  // ============================================================
  // Agent → Skills → Prompts hierarchy diagram
  // ============================================================
  result = result.replace(/<div className="my-8 p-6 bg-muted\/20 rounded-xl border">\s*<div className="flex flex-col items-center gap-6">[\s\S]*?Prompts are atoms[\s\S]*?<\/div>\s*<\/div>/g, () => {
    return `
<div class="demo-box" style="text-align:center;">
  <div class="demo-header">Agent → Skills → Prompts</div>
  <div style="margin:1em 0;">
    <div style="display:inline-block;padding:0.6em 1.5em;background:#dbeafe;border:2px solid #93c5fd;border-radius:50px;font-family:var(--font-sans);font-weight:700;font-size:11pt;">Agent</div>
    <div style="font-size:8pt;color:#78716c;margin:0.2em 0;">Autonomous AI system</div>
  </div>
  <div style="font-size:9pt;color:#78716c;">powered by ↓</div>
  <div style="display:flex;justify-content:center;gap:1em;margin:0.8em 0;">
    <div style="display:inline-block;padding:0.5em 1.2em;background:#f3e8ff;border:2px solid #c4b5fd;border-radius:8px;font-family:var(--font-sans);font-weight:600;font-size:9pt;">Skill</div>
    <div style="display:inline-block;padding:0.5em 1.2em;background:#f3e8ff;border:2px solid #c4b5fd;border-radius:8px;font-family:var(--font-sans);font-weight:600;font-size:9pt;">Skill</div>
    <div style="display:inline-block;padding:0.5em 1.2em;background:#f3e8ff;border:2px solid #c4b5fd;border-radius:8px;font-family:var(--font-sans);font-weight:600;font-size:9pt;">Skill</div>
  </div>
  <div style="font-size:8pt;color:#78716c;margin:0.2em 0;">Reusable expertise packages</div>
  <div style="font-size:9pt;color:#78716c;">composed of ↓</div>
  <div style="display:flex;justify-content:center;gap:0.5em;margin:0.8em 0;flex-wrap:wrap;">
    <span style="display:inline-block;padding:0.3em 0.7em;background:#fef3c7;border:1px solid #fcd34d;border-radius:4px;font-size:8pt;font-family:var(--font-sans);font-weight:500;">Prompt</span>
    <span style="display:inline-block;padding:0.3em 0.7em;background:#fef3c7;border:1px solid #fcd34d;border-radius:4px;font-size:8pt;font-family:var(--font-sans);font-weight:500;">Prompt</span>
    <span style="display:inline-block;padding:0.3em 0.7em;background:#fef3c7;border:1px solid #fcd34d;border-radius:4px;font-size:8pt;font-family:var(--font-sans);font-weight:500;">Prompt</span>
    <span style="display:inline-block;padding:0.3em 0.7em;background:#fef3c7;border:1px solid #fcd34d;border-radius:4px;font-size:8pt;font-family:var(--font-sans);font-weight:500;">Prompt</span>
    <span style="display:inline-block;padding:0.3em 0.7em;background:#fef3c7;border:1px solid #fcd34d;border-radius:4px;font-size:8pt;font-family:var(--font-sans);font-weight:500;">Prompt</span>
  </div>
  <div style="font-size:8pt;color:#78716c;font-style:italic;margin-top:0.8em;">Prompts are atoms → Skills are molecules → Agents are complete structures</div>
</div>
`;
  });

  // ============================================================
  // Cleanup
  // ============================================================
  
  // Remove Icon components - they're decorative
  result = result.replace(/<Icon[A-Za-z]+\s*[^>]*\/>/g, '');
  
  // Clean up React className to class
  result = result.replace(/className=/g, 'class=');
  
  // Remove JSX expressions that won't render
  result = result.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  // Clean up any remaining unknown self-closing components
  result = result.replace(/<[A-Z][a-zA-Z]+\s*[^>]*\/>/g, '');
  // Clean up any remaining unknown components with children
  result = result.replace(/<[A-Z][a-zA-Z]+[^>]*>[\s\S]*?<\/[A-Z][a-zA-Z]+>/g, '');

  // ============================================================
  // Convert Tailwind className divs to inline styles for PDF
  // ============================================================
  result = convertTailwindToInline(result);
  
  return result;
}

/**
 * Convert common Tailwind class patterns in raw HTML blocks to inline styles
 * so they render correctly in the PDF without a Tailwind runtime.
 */
function convertTailwindToInline(html: string): string {
  // Map of Tailwind class → CSS property
  const tw: Record<string, string> = {
    // Display & Flex
    'flex': 'display:flex;',
    'grid': 'display:grid;',
    'inline-block': 'display:inline-block;',
    'inline-flex': 'display:inline-flex;',
    'hidden': 'display:none;',
    'block': 'display:block;',
    'flex-col': 'flex-direction:column;',
    'flex-row': 'flex-direction:row;',
    'flex-wrap': 'flex-wrap:wrap;',
    'flex-1': 'flex:1 1 0%;',
    'items-center': 'align-items:center;',
    'items-start': 'align-items:flex-start;',
    'justify-center': 'justify-content:center;',
    'justify-between': 'justify-content:space-between;',
    'text-center': 'text-align:center;',
    'text-left': 'text-align:left;',
    'text-right': 'text-align:right;',
    'shrink-0': 'flex-shrink:0;',
    // Gaps
    'gap-1': 'gap:0.25em;', 'gap-2': 'gap:0.5em;', 'gap-3': 'gap:0.75em;', 'gap-4': 'gap:1em;', 'gap-6': 'gap:1.5em;', 'gap-8': 'gap:2em;',
    // Padding
    'p-2': 'padding:0.5em;', 'p-3': 'padding:0.75em;', 'p-4': 'padding:1em;', 'p-6': 'padding:1.5em;',
    'px-2': 'padding-left:0.5em;padding-right:0.5em;', 'px-3': 'padding-left:0.75em;padding-right:0.75em;', 'px-4': 'padding-left:1em;padding-right:1em;',
    'py-2': 'padding-top:0.5em;padding-bottom:0.5em;', 'py-3': 'padding-top:0.75em;padding-bottom:0.75em;',
    'pt-2': 'padding-top:0.5em;', 'pt-3': 'padding-top:0.75em;',
    // Margin
    'm-0!': 'margin:0!important;', 'mt-1': 'margin-top:0.25em;', 'mt-2': 'margin-top:0.5em;', 'mb-1': 'margin-bottom:0.25em;', 'mb-2': 'margin-bottom:0.5em;', 'mb-3': 'margin-bottom:0.75em;', 'mb-4': 'margin-bottom:1em;', 'mb-8': 'margin-bottom:2em;',
    'my-4': 'margin-top:1em;margin-bottom:1em;', 'my-6': 'margin-top:1.5em;margin-bottom:1.5em;',
    // Sizing
    'w-full': 'width:100%;',     'w-24': 'width:6rem;', 'w-px': 'width:1px;', 'w-20': 'width:5rem;',
    'min-w-24': 'min-width:6rem;', 'min-w-20': 'min-width:5rem;',
    'h-4': 'height:1rem;', 'w-4': 'width:1rem;',
    'h-5': 'height:1.25rem;', 'w-5': 'width:1.25rem;',
    'w-32': 'width:3rem;', 'h-32': 'height:3rem;',
    // Typography
    'text-xs': 'font-size:8pt;', 'text-sm': 'font-size:9pt;', 'text-lg': 'font-size:12pt;', 'text-2xl': 'font-size:16pt;',
    'font-medium': 'font-weight:500;', 'font-semibold': 'font-weight:600;', 'font-bold': 'font-weight:700;',
    'capitalize': 'text-transform:capitalize;',
    'whitespace-pre-wrap': 'white-space:pre-wrap;',
    'font-mono': 'font-family:var(--font-mono);',
    'leading-relaxed': 'line-height:1.65;',
    'line-through': 'text-decoration:line-through;',
    // Borders & Radius
    'border': PRINT_READY ? 'border:1px solid #ccc;' : 'border:1px solid #e7e5e4;',
    'border-t': PRINT_READY ? 'border-top:1px solid #ccc;' : 'border-top:1px solid #e7e5e4;',
    'border-b': PRINT_READY ? 'border-bottom:1px solid #ccc;' : 'border-bottom:1px solid #e7e5e4;',
    'rounded': 'border-radius:4px;', 'rounded-lg': 'border-radius:6px;', 'rounded-full': 'border-radius:9999px;',
    'overflow-hidden': 'overflow:hidden;', 'overflow-x-auto': 'overflow-x:auto;',
    // Spacing between children
    'space-y-1': '', 'space-y-2': '', 'space-y-4': '',
    // Colors — grayscale for print, RGB for screen
    'text-muted-foreground': PRINT_READY ? 'color:#666;' : 'color:#78716c;',
    'text-blue-700': PRINT_READY ? 'color:#333;' : 'color:#1d4ed8;',
    'text-blue-600': PRINT_READY ? 'color:#333;' : 'color:#2563eb;',
    'text-blue-400': PRINT_READY ? 'color:#666;' : 'color:#60a5fa;',
    'text-green-700': PRINT_READY ? 'color:#333;' : 'color:#15803d;',
    'text-green-600': PRINT_READY ? 'color:#333;' : 'color:#16a34a;',
    'text-green-400': PRINT_READY ? 'color:#666;' : 'color:#4ade80;',
    'text-purple-700': PRINT_READY ? 'color:#333;' : 'color:#7e22ce;',
    'text-purple-600': PRINT_READY ? 'color:#333;' : 'color:#9333ea;',
    'text-purple-400': PRINT_READY ? 'color:#666;' : 'color:#c084fc;',
    'text-red-700': PRINT_READY ? 'color:#333;' : 'color:#b91c1c;',
    'text-red-600': PRINT_READY ? 'color:#333;' : 'color:#dc2626;',
    'text-red-400': PRINT_READY ? 'color:#666;' : 'color:#f87171;',
    'text-amber-700': PRINT_READY ? 'color:#333;' : 'color:#b45309;',
    'text-amber-400': PRINT_READY ? 'color:#666;' : 'color:#fbbf24;',
    'text-cyan-700': PRINT_READY ? 'color:#333;' : 'color:#0e7490;',
    'text-cyan-400': PRINT_READY ? 'color:#666;' : 'color:#22d3ee;',
    'text-white': 'color:white;',
    // Backgrounds
    'bg-muted/30': PRINT_READY ? 'background:#f2f2f2;' : 'background:#f5f5f4;',
    'bg-muted/50': PRINT_READY ? 'background:#f2f2f2;' : 'background:#f5f5f4;',
    'bg-muted': PRINT_READY ? 'background:#f2f2f2;' : 'background:#f0f0ee;',
    'bg-background': 'background:white;', 'bg-card': 'background:white;',
    'bg-blue-100': PRINT_READY ? 'background:#f2f2f2;' : 'background:#dbeafe;',
    'bg-blue-50': PRINT_READY ? 'background:#fff;' : 'background:#eff6ff;',
    'bg-blue-50/50': PRINT_READY ? 'background:#fff;' : 'background:#f7fbff;',
    'bg-green-100': PRINT_READY ? 'background:#f2f2f2;' : 'background:#dcfce7;',
    'bg-green-50': PRINT_READY ? 'background:#fff;' : 'background:#f0fdf4;',
    'bg-green-50/50': PRINT_READY ? 'background:#fff;' : 'background:#f8fef9;',
    'bg-purple-100': PRINT_READY ? 'background:#f2f2f2;' : 'background:#f3e8ff;',
    'bg-purple-50': PRINT_READY ? 'background:#fff;' : 'background:#faf5ff;',
    'bg-purple-50/50': PRINT_READY ? 'background:#fff;' : 'background:#fdfaff;',
    'bg-red-50/50': PRINT_READY ? 'background:#f2f2f2;' : 'background:#fef7f7;',
    'bg-red-50': PRINT_READY ? 'background:#f2f2f2;' : 'background:#fef2f2;',
    'bg-amber-50/50': PRINT_READY ? 'background:#fff;' : 'background:#fffdf7;',
    'bg-amber-50': PRINT_READY ? 'background:#fff;' : 'background:#fffbeb;',
    'bg-cyan-50/50': PRINT_READY ? 'background:#fff;' : 'background:#f0fdff;',
    // Border colors
    'border-blue-200': PRINT_READY ? 'border-color:#ccc;' : 'border-color:#bfdbfe;',
    'border-blue-800': '',
    'border-blue-300': PRINT_READY ? 'border-color:#ccc;' : 'border-color:#93c5fd;',
    'border-green-200': PRINT_READY ? 'border-color:#ccc;' : 'border-color:#bbf7d0;',
    'border-green-900': '',
    'border-green-300': PRINT_READY ? 'border-color:#ccc;' : 'border-color:#86efac;',
    'border-purple-200': PRINT_READY ? 'border-color:#ccc;' : 'border-color:#e9d5ff;',
    'border-purple-800': '',
    'border-purple-300': PRINT_READY ? 'border-color:#ccc;' : 'border-color:#c4b5fd;',
    'border-red-200': PRINT_READY ? 'border-color:#ccc;' : 'border-color:#fecaca;',
    'border-red-900': '',
    'border-amber-200': PRINT_READY ? 'border-color:#ccc;' : 'border-color:#fde68a;',
    'border-amber-900': '',
    'border-cyan-200': PRINT_READY ? 'border-color:#ccc;' : 'border-color:#a5f3fc;',
    'border-cyan-900': '',
    // Grid
    'grid-cols-2': 'grid-template-columns:1fr 1fr;', 'grid-cols-4': 'grid-template-columns:1fr 1fr 1fr 1fr;',
    'md:grid-cols-2': 'grid-template-columns:1fr 1fr;', 'md:grid-cols-3': 'grid-template-columns:1fr 1fr 1fr;', 'md:grid-cols-4': 'grid-template-columns:1fr 1fr 1fr 1fr;',
    // Extra borders & bg
    'border-2': 'border-width:2px;',
    'border-primary': PRINT_READY ? 'border-color:#000;' : 'border-color:#7c3aed;',
    'bg-primary/10': PRINT_READY ? 'background:#f2f2f2;' : 'background:rgba(124,58,237,0.1);',
  };

  // Process each element that has a class attribute
  return html.replace(/class="([^"]+)"/g, (match, classes: string) => {
    const classList = classes.split(/\s+/);
    const styles: string[] = [];
    const remainingClasses: string[] = [];

    for (const cls of classList) {
      // Skip dark mode variants
      if (cls.startsWith('dark:')) continue;
      // Skip responsive prefixes that we can't handle (except md: grid which we keep)
      if (cls.startsWith('sm:') || cls.startsWith('lg:') || cls.startsWith('xl:')) continue;
      // Handle md: prefix
      const effectiveCls = cls.startsWith('md:') ? cls : cls;

      if (tw[effectiveCls]) {
        styles.push(tw[effectiveCls]);
      } else {
        remainingClasses.push(cls);
      }
    }

    if (styles.length === 0) return match;

    const styleStr = styles.filter(Boolean).join('');
    const classStr = remainingClasses.length > 0 ? ` class="${remainingClasses.join(' ')}"` : '';
    return `${classStr} style="${styleStr}"`.trim();
  });
}

/**
 * Convert all inline color values in style attributes to grayscale for print.
 * Replaces colored hex values and rgba with gray equivalents.
 */
function convertStylesToGrayscale(html: string): string {
  if (!PRINT_READY) return html;
  
  // Map of specific hex colors to grayscale
  const colorToGray: Record<string, string> = {
    // Blues
    '#3b82f6': '#666', '#2563eb': '#333', '#1d4ed8': '#333', '#60a5fa': '#999',
    '#dbeafe': '#f2f2f2', '#bfdbfe': '#ccc', '#93c5fd': '#ccc', '#eff6ff': '#fff',
    // Greens
    '#22c55e': '#666', '#16a34a': '#333', '#15803d': '#333', '#4ade80': '#999',
    '#dcfce7': '#f2f2f2', '#bbf7d0': '#ccc', '#86efac': '#ccc', '#f0fdf4': '#fff',
    '#166534': '#333',
    // Purples
    '#7c3aed': '#000', '#9333ea': '#333', '#7e22ce': '#333', '#c084fc': '#999', '#a78bfa': '#666',
    '#f3e8ff': '#f2f2f2', '#e9d5ff': '#ccc', '#c4b5fd': '#ccc', '#faf5ff': '#fff',
    '#5b2d8e': '#333',
    // Reds
    '#dc2626': '#333', '#b91c1c': '#333', '#f87171': '#999',
    '#fef2f2': '#f2f2f2', '#fecaca': '#ccc', '#450a0a': '#333',
    // Ambers
    '#f59e0b': '#666', '#d97706': '#333', '#b45309': '#333', '#fbbf24': '#999', '#92400e': '#333',
    '#fef3c7': '#f2f2f2', '#fde68a': '#ccc', '#fffbeb': '#fff', '#fcd34d': '#ccc',
    // Cyan
    '#0e7490': '#333', '#22d3ee': '#999',
    '#cffafe': '#f2f2f2', '#a5f3fc': '#ccc', '#67e8f9': '#ccc',
    // Pinks
    '#fce7f3': '#f2f2f2', '#f9a8d4': '#ccc',
    // Rose
    '#ef4444': '#333', '#f97316': '#555',
    // Misc
    '#e5e7eb': '#ccc',
    '#78716c': '#666', '#c41d7f': '#333',
    // Traffic light dots
    '#ff5f56': '#999', '#ffbd2e': '#999', '#27c93f': '#999',
    '#f8fafc': '#fff', '#f8fdf9': '#fff', '#faf8ff': '#fff', '#fffbf5': '#fff',
    '#fefce8': '#fff',
  };
  
  // Replace hex colors in both inline style attributes and CSS
  let result = html;
  for (const [color, gray] of Object.entries(colorToGray)) {
    result = result.split(color).join(gray);
  }
  // Replace rgba colors with gray
  result = result.replace(/rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)/g, '#f2f2f2');
  // Replace linear-gradient colors
  result = result.replace(/linear-gradient\([^)]*\)/g, (match) => {
    let g = match;
    for (const [color, gray] of Object.entries(colorToGray)) {
      g = g.split(color).join(gray);
    }
    return g;
  });
  return result;
}

/**
 * Convert prompt variables like ${field} and ${years:10} to printable blanks
 * \${name} or ${name} → _______ (name)
 * \${name:default} or ${name:default} → _______ (name, e.g. default)
 */
function convertPromptVariables(text: string): string {
  return text.replace(/\\?\$\{([^:}]+)(?::([^}]*))?\}/g, (_, name, defaultVal) => {
    if (defaultVal) {
      return `_______ (${name}, e.g. ${defaultVal})`;
    }
    return `_______ (${name})`;
  });
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convert MDX to HTML
 */
function mdxToHtml(mdx: string): string {
  let html = mdx;
  
  // Code blocks FIRST - protect content from all markdown processing
  // Handle quadruple-backtick blocks first (which can contain triple backticks)
  // Fences must be at start of line
  html = html.replace(/^````(\w*)\n([\s\S]*?)^````\s*$/gm, (_, lang, code) => {
    const protectedCode = protectCodeBlock(escapeHtml(code.trim()));
    return `<pre class="code-block${lang ? ` language-${lang}` : ''}"><code>${protectedCode}</code></pre>`;
  });
  // Then handle triple-backtick blocks (fences at start of line)
  html = html.replace(/^```(\w*)\n([\s\S]*?)^```\s*$/gm, (_, lang, code) => {
    const protectedCode = protectCodeBlock(escapeHtml(code.trim()));
    return `<pre class="code-block${lang ? ` language-${lang}` : ''}"><code>${protectedCode}</code></pre>`;
  });
  
  // Inline code - protect before italic/bold
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const protectedCode = protectCodeBlock(escapeHtml(code));
    return `<code>${protectedCode}</code>`;
  });
  
  // Headers
  html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Underscore italic: only match single words wrapped in underscores, not runs of underscores
  html = html.replace(/(?<![_\w])_([^_\n]+?)_(?![_\w])/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />');
  
  // Lists (basic)
  html = html.replace(/^-\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\.\s+(.*)$/gm, '<li>$2</li>');
  
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>\n${match}</ul>\n`);
  
  // Blockquotes: lines starting with >
  html = html.replace(/(^>\s?.+$\n?)+/gm, (match) => {
    const content = match.replace(/^>\s?/gm, '').trim();
    return `<blockquote>${content}</blockquote>\n`;
  });
  
  // Paragraphs (lines that aren't already HTML)
  html = html.split('\n\n').map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('<')) return block;
    if (block.match(/^<(div|p|ul|ol|h[1-6]|pre|blockquote|hr|table)/)) return block;
    return `<p>${block}</p>`;
  }).join('\n\n');
  
  return html;
}

// Storage for protected code blocks that shouldn't be markdown-processed
const protectedBlocks: Map<string, string> = new Map();
let blockCounter = 0;

/**
 * Protect a code block from markdown processing
 * Uses a format that won't be affected by markdown conversion
 */
function protectCodeBlock(content: string): string {
  const id = `<!--CODEBLOCK${blockCounter++}-->`;
  protectedBlocks.set(id, content);
  blockCounter++;
  return id;
}

/**
 * Restore protected code blocks after markdown processing
 */
function restoreProtectedBlocks(html: string): string {
  let result = html;
  for (const [id, content] of protectedBlocks) {
    result = result.split(id).join(content);
  }
  protectedBlocks.clear();
  return result;
}

/**
 * Read and process a chapter
 */
function processChapter(locale: string, chapter: Chapter, localeData: LocaleData, messages: Record<string, unknown>): ProcessedChapter | null {
  const localePath = getLocalePath(locale);
  const filePath = path.join(localePath, `${chapter.slug}.mdx`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠ Skipping ${chapter.slug} (not found for ${locale})`);
    return null;
  }
  
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const transformedContent = transformMdxForPdf(rawContent, locale, localeData, messages);
  const htmlContent = mdxToHtml(transformedContent);
  const restoredContent = restoreProtectedBlocks(htmlContent);
  const withEndnotes = convertLinksToEndnotes(restoredContent, messages, locale);
  const finalContent = convertStylesToGrayscale(withEndnotes);
  
  return {
    slug: chapter.slug,
    title: chapter.title,
    part: chapter.part,
    content: finalContent,
  };
}

/**
 * Convert external <a href="..."> links to numbered endnotes at the end of the chapter.
 * Internal links (starting with /) are left as plain text references.
 */
function convertLinksToEndnotes(html: string, messages: Record<string, unknown> = {}, _locale: string = 'en'): string {
  const msgLinks = t(messages, 'book.interactive.links');
  const linksLabel = (msgLinks !== 'book.interactive.links') ? msgLinks : 'Links';
  const footnotes: { num: number; text: string; url: string }[] = [];
  let counter = 0;
  
  // Replace external links with text + superscript number
  const processed = html.replace(/<a href="((?:https?:\/\/)[^"]+)"[^>]*>([^<]+)<\/a>/g, (_, url, text) => {
    counter++;
    footnotes.push({ num: counter, text, url });
    return `${text}<sup class="fn-ref">${counter}</sup>`;
  });
  
  // Replace internal links with just the text (no footnote needed)
  const cleaned = processed.replace(/<a href="\/[^"]*"[^>]*>([^<]+)<\/a>/g, '$1');
  
  if (footnotes.length === 0) return cleaned;
  
  // Build endnotes section
  const notesHtml = footnotes.map(fn => 
    `<div class="fn-item"><span class="fn-num">${fn.num}.</span> <span class="fn-url">${fn.url}</span></div>`
  ).join('\n');
  
  return `${cleaned}
<div class="fn-section">
  <div class="fn-title">${linksLabel}</div>
  ${notesHtml}
</div>`;
}

/**
 * Map part slugs to message keys for translation
 */
const PART_TRANSLATION_KEYS: Record<string, string> = {
  'Introduction': 'introduction',
  'Foundations': 'foundations',
  'Techniques': 'techniques',
  'Advanced': 'advanced',
  'Advanced Strategies': 'advanced',
  'Best Practices': 'bestPractices',
  'Use Cases': 'useCases',
  'Conclusion': 'conclusion',
};

/**
 * Generate the HTML document for PDF
 * 
 * @param chapters - The array of processed chapters to include.
 * @param locale - The locale string.
 * @param messages - Translation messages for the document metadata and labels.
 * @returns The final HTML document as a string.
 */

function generateHtmlDocument(chapters: ProcessedChapter[], locale: string, messages: Record<string, unknown> = {}): string {
  // Print version uses shorter printTitle, screen uses full title
  const titleKey = PRINT_READY ? 'book.printTitle' : 'book.title';
  const msgTitle = t(messages, titleKey);
  const title = (msgTitle !== titleKey) ? msgTitle : (BOOK_TITLES_FALLBACK[locale] || BOOK_TITLES_FALLBACK.en);
  const subtitleKey = PRINT_READY ? 'book.printSubtitle' : 'book.subtitle';
  const msgSubtitle = t(messages, subtitleKey);
  const subtitle = (msgSubtitle !== subtitleKey) ? msgSubtitle : 'A Comprehensive Guide to AI Prompt Engineering';
  const isRtl = ['ar', 'he', 'fa'].includes(locale);
  const isCjk = ['zh', 'ja', 'ko'].includes(locale);
  const fonts = getFontStacks(locale);
  const headingFont = isCjk ? fonts.serif : fonts.sans;
  const promptFont = isCjk ? fonts.sans : fonts.mono;
  
  // Helper to translate part name
  const translatePart = (partName: string): string => {
    const key = PART_TRANSLATION_KEYS[partName];
    if (key) {
      const translated = t(messages, `book.parts.${key}`);
      if (translated !== `book.parts.${key}`) return translated;
    }
    return partName;
  };
  
  // Helper to translate chapter title
  const translateChapter = (slug: string, fallback: string): string => {
    const translated = t(messages, `book.chapters.${slug}`);
    if (translated !== `book.chapters.${slug}`) return translated;
    return fallback;
  };
  
  // TOC heading
  const contentsLabel = t(messages, 'book.tableOfContents');
  const tocTitle = (contentsLabel !== 'book.tableOfContents') ? contentsLabel : 'Contents';
  
  // Group chapters by part — only break pages at new parts, not every chapter
  let chapterNumber = 0;
  let currentPart = '';
  const chaptersHtml = chapters.map((chapter) => {
    chapterNumber++;
    const translatedPart = translatePart(chapter.part);
    const translatedTitle = translateChapter(chapter.slug, chapter.title);
    const isNewPart = chapter.part !== currentPart;
    currentPart = chapter.part;
    const sectionClass = isNewPart ? 'chapter chapter-new-part' : 'chapter';
    return `
    <section class="${sectionClass}" id="${chapter.slug}">
      <div class="chapter-opener">
        <div class="chapter-number">${chapterNumber}</div>
        <div class="chapter-meta">
          <span class="chapter-part">${translatedPart}</span>
          <h1 class="chapter-title">${translatedTitle}</h1>
        </div>
        <div class="chapter-rule"></div>
      </div>
      <div class="chapter-content">
        ${chapter.content}
      </div>
    </section>
  `;
  }).join('\n');
  
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    /* ========================================
       BOOK SIZE: 6" x 9" (US Trade)
       ${PRINT_READY ? 'PRINT-READY: includes 0.125in bleed on all sides' : 'Screen-optimized'}
       ======================================== */
    @page {
      size: ${PRINT_READY ? BLEED_WIDTH + ' ' + BLEED_HEIGHT : '6in 9in'};
      margin: ${PRINT_READY ? '0.7in 0.65in 0.75in 0.65in' : '0.55in 0.5in 0.6in 0.5in'};
      ${PRINT_READY ? 'marks: crop cross;\n      bleed: ' + BLEED + ';' : ''}
    }
    
    /* ========================================
       BASE TYPOGRAPHY
       ======================================== */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    :root {
      /* ${PRINT_READY ? 'B&W grayscale palette for print' : 'Screen RGB palette'} */
      --color-text: ${PRINT_READY ? '#000000' : '#1c1917'};
      --color-text-muted: ${PRINT_READY ? '#333333' : '#57534e'};
      --color-text-light: ${PRINT_READY ? '#666666' : '#78716c'};
      --color-accent: ${PRINT_READY ? '#000000' : '#7c3aed'};
      --color-accent-light: ${PRINT_READY ? '#666666' : '#a78bfa'};
      --color-bg-subtle: ${PRINT_READY ? '#ffffff' : '#fafaf9'};
      --color-bg-muted: ${PRINT_READY ? '#f2f2f2' : '#f5f5f4'};
      --color-border: ${PRINT_READY ? '#cccccc' : '#e7e5e4'};
      --color-border-dark: ${PRINT_READY ? '#999999' : '#d6d3d1'};
      --font-serif: ${fonts.serif};
      --font-sans: ${fonts.sans};
      --font-heading: ${headingFont};
      --font-mono: ${fonts.mono};
      --font-prompt: ${promptFont};
    }
    
    body {
      font-family: var(--font-serif);
      font-size: 10.5pt;
      line-height: 1.65;
      color: var(--color-text);
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      font-feature-settings: 'liga' 1, 'kern' 1;
      hyphens: auto;
      orphans: 3;
      widows: 3;
      
    }
    
    /* ========================================
       COVER PAGE
       ======================================== */
    .cover {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      min-height: 100vh;
      padding: 0 2em 3em 2em;
    }
    
    .cover-rule {
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, var(--color-accent), var(--color-accent-light), transparent);
      margin-bottom: 2em;
    }
    
    .cover h1 {
      font-family: var(--font-heading);
      font-size: 30pt;
      font-weight: 800;
      color: var(--color-text);
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 0.3em;
    }
    
    .cover .subtitle {
      font-family: var(--font-serif);
      font-size: 11pt;
      font-style: italic;
      color: var(--color-text-muted);
      margin-bottom: 2.5em;
    }
    
    .cover-author {
      display: flex;
      align-items: center;
      gap: 0.8em;
      margin-bottom: 2em;
    }
    
    .cover-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }
    
    .cover-author-info {
      line-height: 1.3;
    }
    
    .cover .author-name {
      font-family: var(--font-sans);
      font-size: 11pt;
      font-weight: 600;
      color: var(--color-text);
      display: block;
    }
    
    .cover .author-desc {
      font-family: var(--font-sans);
      font-size: 8pt;
      color: var(--color-text-light);
      display: block;
    }
    
    .cover .url {
      font-family: var(--font-sans);
      font-size: 8pt;
      color: var(--color-text-light);
      letter-spacing: 0.02em;
    }
    
    /* ========================================
       TABLE OF CONTENTS
       ======================================== */
    .toc {
      page-break-after: always;
      padding-top: 1.5em;
    }
    
    .toc-title {
      font-family: var(--font-heading);
      font-size: 18pt;
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 1.5em;
      padding-bottom: 0.5em;
      border-bottom: 2px solid var(--color-text);
    }
    
    .toc-part {
      font-family: var(--font-heading);
      font-size: 10pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-accent);
      margin-top: 1.5em;
      margin-bottom: 0.6em;
      padding-top: 0.8em;
      border-top: 1px solid var(--color-border);
    }
    
    .toc-part:first-of-type {
      border-top: none;
      padding-top: 0;
    }
    
    .toc-chapter {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.35em;
      padding-left: 1em;
    }
    
    .toc-chapter a {
      font-family: var(--font-serif);
      font-size: 10pt;
      color: var(--color-text);
      text-decoration: none;
      flex: 1;
    }
    
    .toc-dots {
      flex: 1;
      border-bottom: 1px dotted var(--color-border-dark);
      margin: 0 0.5em 0.3em 0.5em;
    }
    
    /* ========================================
       CHAPTERS
       ======================================== */
    .chapter {
      page-break-before: always;
    }
    
    .chapter-opener {
      margin-top: 2em;
      margin-bottom: 1.5em;
      padding-top: 1em;
    }
    
    .chapter-new-part .chapter-opener {
      margin-top: 0;
      padding-top: 1.5em;
    }
    
    .chapter-number {
      font-family: var(--font-sans);
      font-size: 42pt;
      font-weight: 100;
      color: var(--color-accent-light);
      line-height: 1;
      margin-bottom: 0.1em;
    }
    
    .chapter-meta {
      padding: 0;
    }
    
    .chapter-part {
      font-family: var(--font-heading);
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-text-light);
      display: block;
      margin-bottom: 0.4em;
    }
    
    .chapter-title {
      font-family: var(--font-heading);
      font-size: 22pt;
      font-weight: 700;
      color: var(--color-text);
      line-height: 1.15;
      letter-spacing: -0.02em;
      margin: 0 0 0.5em 0;
    }
    
    .chapter-rule {
      width: 3em;
      height: 1px;
      background: var(--color-accent);
    }
    
    .chapter-content {
      columns: 1;
    }
    
    /* ========================================
       HEADINGS
       ======================================== */
    h1 {
      font-family: var(--font-heading);
      font-size: 15pt;
      font-weight: 700;
      color: var(--color-text);
      margin-top: 2em;
      margin-bottom: 0.5em;
      line-height: 1.25;
      letter-spacing: -0.03em;
    }
    
    h2 {
      font-family: var(--font-heading);
      font-size: 12.5pt;
      font-weight: 700;
      color: var(--color-text);
      margin-top: 1.8em;
      margin-bottom: 0.5em;
      padding-bottom: 0.25em;
      border-bottom: 1px solid var(--color-border);
      line-height: 1.3;
      letter-spacing: -0.005em;
    }
    
    h3 {
      font-family: var(--font-heading);
      font-size: 10.5pt;
      font-weight: 700;
      color: var(--color-text);
      margin-top: 1.5em;
      margin-bottom: 0.4em;
      line-height: 1.35;
    }
    
    h4 {
      font-family: var(--font-heading);
      font-size: 10pt;
      font-weight: 600;
      color: var(--color-text-muted);
      margin-top: 1.3em;
      margin-bottom: 0.3em;
      line-height: 1.4;
    }
    
    /* ========================================
       BODY TEXT
       ======================================== */
    p {
      margin-bottom: 0.9em;
      text-align: justify;
      text-justify: inter-word;
    }
    
    /* First paragraph after heading - no indent, with drop cap option */
    h1 + p, h2 + p, h3 + p, h4 + p,
    .chapter-content > p:first-child {
      text-indent: 0;
    }
    
    /* Subsequent paragraphs - indented */
    p + p {
      text-indent: 1.5em;
      margin-top: -0.2em;
    }
    
    strong {
      font-weight: 600;
    }
    
    em {
      font-style: italic;
    }
    
    a {
      color: var(--color-accent);
      text-decoration: none;
      border-bottom: 1px solid var(--color-accent-light);
    }
    
    /* ========================================
       LISTS
       ======================================== */
    ul, ol {
      margin: 1em 0;
      padding-left: 1.5em;
    }
    
    li {
      margin-bottom: 0.4em;
      line-height: 1.5;
    }
    
    li p {
      margin-bottom: 0.3em;
    }
    
    /* ========================================
       CODE
       ======================================== */
    code {
      font-family: var(--font-mono);
      font-size: 0.85em;
      background: var(--color-bg-muted);
      padding: 0.15em 0.35em;
      border-radius: 3px;
      color: #c41d7f;
    }
    
    pre, .code-block {
      font-family: var(--font-mono);
      font-size: 8.5pt;
      line-height: 1.5;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1em 1.2em;
      border-radius: 4px;
      margin: 1.2em 0;
      overflow-x: auto;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    pre code, .code-block code {
      background: none;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }
    
    .prompt-code {
      font-family: var(--font-prompt);
      font-size: 8.5pt;
      line-height: 1.5;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1em 1.2em;
      border-radius: 4px;
      white-space: pre-wrap;
      margin: 0.8em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* ========================================
       TRY IT BOX
       ======================================== */
    .tryit-box {
      background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
      border: 1px solid #e9d5ff;
      border-left: 4px solid var(--color-accent);
      border-radius: 0 6px 6px 0;
      padding: 1.2em;
      margin: 1.5em 0;
    }
    
    .tryit-header {
      font-family: var(--font-sans);
      font-size: 9pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-accent);
      margin-bottom: 0.6em;
    }
    
    .tryit-desc {
      font-size: 9pt;
      color: var(--color-text-muted);
      margin-bottom: 0.8em;
      font-style: italic;
    }
    
    /* ========================================
       QUIZ BOX
       ======================================== */
    .quiz-box {
      background: var(--color-bg-subtle);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 1.2em;
      margin: 1.5em 0;
    }
    
    .quiz-header {
      font-family: var(--font-sans);
      font-size: 9pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      margin-bottom: 0.8em;
    }
    
    .quiz-question {
      font-size: 10pt;
      margin-bottom: 0.8em;
    }
    
    .quiz-options {
      font-size: 9.5pt;
      margin: 0.8em 0;
      padding-left: 0.5em;
      white-space: pre-line;
      line-height: 1.8;
    }
    
    .quiz-explanation {
      font-size: 9pt;
      color: var(--color-text-muted);
      font-style: italic;
      margin-top: 1em;
      padding-top: 0.8em;
      border-top: 1px dashed var(--color-border);
    }
    
    /* ========================================
       CALLOUT BOXES
       ======================================== */
    .callout {
      background: var(--color-bg-subtle);
      border-radius: 4px;
      padding: 1em 1.2em;
      margin: 1.5em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .callout-info {
      background: #f8fafc;
    }
    
    .callout-warning {
      background: #fffbf5;
    }
    
    .callout-tip {
      background: #f8fdf9;
    }
    
    .callout-example {
      background: #faf8ff;
    }
    
    .callout-header {
      font-family: var(--font-sans);
      font-size: 9pt;
      font-weight: 600;
      margin-bottom: 0.5em;
      color: var(--color-text-muted);
    }
    
    .callout-content {
      font-size: 9.5pt;
      line-height: 1.55;
    }
    
    /* ========================================
       INFO GRID
       ======================================== */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.8em;
      margin: 1.5em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .info-item {
      background: var(--color-bg-muted);
      padding: 0.8em;
      border-radius: 4px;
      font-size: 9pt;
      line-height: 1.5;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .info-item strong {
      font-family: var(--font-sans);
      font-size: 8.5pt;
    }
    
    /* ========================================
       CHECKLIST
       ======================================== */
    .checklist {
      background: var(--color-bg-subtle);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 1em 1.2em;
      margin: 1.5em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .checklist-title {
      font-family: var(--font-sans);
      font-size: 9pt;
      font-weight: 600;
      margin-bottom: 0.6em;
    }
    
    .checklist ul {
      list-style: none;
      padding-left: 0;
      margin: 0;
    }
    
    .checklist li {
      font-size: 9.5pt;
      margin-bottom: 0.3em;
      padding-left: 0.3em;
    }
    
    /* ========================================
       COMPARE BOX
       ======================================== */
    .compare-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.8em;
      margin: 1.5em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .compare-item {
      padding: 0.8em;
      border-radius: 4px;
      font-size: 9pt;
      line-height: 1.5;
    }
    
    .compare-before {
      background: #fef2f2;
      border: 1px solid #fecaca;
    }
    
    .compare-after {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }
    
    /* ========================================
       DEMO BOXES (static rendered components)
       ======================================== */
    .demo-box {
      background: var(--color-bg-subtle);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 1.2em;
      margin: 1.5em 0;
    }
    
    .demo-header {
      font-family: var(--font-sans);
      font-size: 9.5pt;
      font-weight: 600;
      color: var(--color-text-muted);
      margin-bottom: 0.8em;
      padding-bottom: 0.5em;
      border-bottom: 1px solid var(--color-border);
    }
    
    .demo-label {
      font-size: 9pt;
      color: var(--color-text-muted);
      margin: 0.4em 0;
    }
    
    .demo-note {
      font-size: 8.5pt;
      color: var(--color-text-light);
      font-style: italic;
      margin: 0.6em 0;
    }
    
    .demo-section {
      font-size: 9pt;
      margin-top: 1em;
      margin-bottom: 0.3em;
    }
    
    .demo-text {
      font-size: 9pt;
      background: var(--color-bg-muted);
      padding: 0.6em;
      border-radius: 4px;
      margin: 0.3em 0;
    }
    
    .demo-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin: 0.8em 0;
    }
    
    .demo-table th {
      font-family: var(--font-sans);
      background: var(--color-bg-muted);
      padding: 0.5em 0.8em;
      text-align: left;
      border-bottom: 2px solid var(--color-border);
      font-weight: 600;
    }
    
    .demo-table td {
      padding: 0.4em 0.8em;
      border-bottom: 1px solid var(--color-border);
    }
    
    /* ========================================
       EXERCISE BOXES (fill-in-blank, debugger, challenges)
       ======================================== */
    .exercise-box {
      background: #fefce8;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 1.2em;
      margin: 1.5em 0;
    }
    
    .exercise-header {
      font-family: var(--font-sans);
      font-size: 9.5pt;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 0.8em;
    }
    
    .exercise-section {
      font-size: 9pt;
      margin-top: 0.8em;
      margin-bottom: 0.3em;
    }
    
    .exercise-answers {
      font-size: 8.5pt;
      margin-top: 0.8em;
      padding-top: 0.6em;
      border-top: 1px dashed #fde68a;
    }
    
    .exercise-hint {
      font-size: 8.5pt;
      color: #92400e;
      font-style: italic;
      margin: 0.6em 0;
    }
    
    .difficulty-badge {
      font-size: 7pt;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--color-bg-muted);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      vertical-align: middle;
    }
    
    .prompt-code-error {
      border: 1px solid #fecaca;
      background: #450a0a;
    }

    /* ========================================
       PREDICTION TOKENS
       ======================================== */
    .prediction-step {
      display: flex;
      align-items: baseline;
      gap: 0.8em;
      margin: 0.5em 0;
      font-size: 9pt;
    }
    
    .prediction-context {
      font-family: var(--font-mono);
      font-size: 8.5pt;
      color: var(--color-text-muted);
      min-width: 40%;
    }
    
    .prediction-options {
      font-size: 8.5pt;
    }
    
    .prediction-token {
      display: inline-block;
      background: var(--color-bg-muted);
      padding: 1px 6px;
      border-radius: 3px;
      margin: 0 2px;
      font-family: var(--font-mono);
    }
    
    .prediction-prob {
      font-size: 7pt;
      color: var(--color-text-light);
    }

    /* ========================================
       QUIZ ENHANCEMENTS
       ======================================== */
    .quiz-correct {
      font-weight: 600;
    }
    
    .quiz-options div {
      font-size: 9pt;
      padding: 0.15em 0;
      line-height: 1.4;
    }

    /* ========================================
       TEMPERATURE LEVELS
       ======================================== */
    .temp-level {
      margin: 0.8em 0;
      padding: 0.6em;
      background: var(--color-bg-muted);
      border-radius: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .temp-label {
      font-family: var(--font-sans);
      font-size: 9pt;
      margin-bottom: 0.3em;
    }
    
    .temp-example {
      font-size: 8.5pt;
      font-family: var(--font-mono);
      color: var(--color-text-muted);
      margin: 0.2em 0;
    }
    
    .temp-use {
      font-size: 8pt;
      color: var(--color-text-light);
      font-style: italic;
      margin-top: 0.3em;
    }

    /* ========================================
       ITERATION STEPS
       ======================================== */
    .iteration-step {
      margin: 1em 0;
      padding: 0.8em;
      background: var(--color-bg-muted);
      border-radius: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .iteration-header {
      font-family: var(--font-sans);
      font-size: 9pt;
      font-weight: 600;
      margin-bottom: 0.5em;
    }
    
    .iteration-output {
      font-size: 9pt;
      color: var(--color-text-muted);
      padding: 0.5em;
      background: white;
      border-radius: 3px;
      margin-top: 0.5em;
    }
    
    .iteration-issue {
      font-size: 8.5pt;
      color: #92400e;
      margin-top: 0.4em;
    }
    
    .iteration-success {
      font-size: 8.5pt;
      color: #166534;
      margin-top: 0.4em;
    }

    /* ========================================
       COST RESULTS
       ======================================== */
    .cost-results {
      display: flex;
      gap: 0.8em;
      margin: 1em 0;
    }
    
    .cost-item {
      flex: 1;
      text-align: center;
      padding: 0.6em;
      background: var(--color-bg-muted);
      border-radius: 4px;
      font-size: 9pt;
    }

    /* ========================================
       CHAIN BOXES (ChainExample)
       ======================================== */
    .chain-box {
      border: 1px solid var(--color-border);
      border-radius: 6px;
      margin: 1.2em 0;
      overflow: hidden;
    }
    
    .chain-box-header {
      font-family: var(--font-sans);
      font-size: 8.5pt;
      font-weight: 500;
      color: var(--color-text-muted);
      padding: 0.4em 1em;
      background: var(--color-bg-muted);
      border-bottom: 1px solid var(--color-border);
    }
    
    .chain-step-item, .chain-step-skipped {
      display: flex;
      gap: 0.8em;
      padding: 0.6em 1em;
    }
    
    .chain-step-skipped {
      opacity: 0.5;
    }
    
    .chain-step-num {
      font-family: var(--font-sans);
      font-size: 8pt;
      font-weight: 600;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-bg-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    
    .chain-step-body {
      flex: 1;
      min-width: 0;
    }
    
    .chain-step-name {
      font-family: var(--font-sans);
      font-size: 9pt;
      font-weight: 600;
      margin-bottom: 0.3em;
    }
    
    .chain-step-prompt, .chain-step-output {
      font-family: var(--font-mono);
      font-size: 7.5pt;
      line-height: 1.4;
      padding: 0.4em 0.6em;
      border-radius: 3px;
      margin: 0.2em 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    .chain-step-prompt {
      background: var(--color-bg-muted);
    }
    
    .chain-step-output {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }
    
    .chain-label {
      font-family: var(--font-sans);
      font-size: 7pt;
      font-weight: 600;
      color: var(--color-text-light);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    
    .chain-step-skipped-note {
      font-size: 8pt;
      font-style: italic;
      color: var(--color-text-light);
    }
    
    .chain-connector {
      height: 1px;
      background: var(--color-border);
      margin: 0 1em 0 2.6em;
    }
    
    .chain-connector-parallel {
      height: 1px;
      background: var(--color-border);
      margin: 0 1em 0 2.6em;
      border-top-style: dashed;
    }
    
    .chain-loop-note {
      font-family: var(--font-sans);
      font-size: 8pt;
      color: var(--color-text-light);
      text-align: center;
      padding: 0.5em;
      border-top: 1px dashed var(--color-border);
    }

    /* ========================================
       CHAIN FLOW DEMO (type overview)
       ======================================== */
    .chain-types-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.8em;
    }
    
    .chain-type-card {
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 0.8em;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .chain-type-name {
      font-family: var(--font-sans);
      font-size: 9pt;
      font-weight: 700;
      margin-bottom: 0.2em;
    }
    
    .chain-type-desc {
      font-size: 8pt;
      color: var(--color-text-muted);
      margin-bottom: 0.5em;
    }
    
    .chain-type-diagram {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.2em;
      flex-wrap: wrap;
    }
    
    .chain-type-diagram-parallel {
      flex-direction: column;
    }
    
    .chain-type-step {
      display: inline-block;
      font-family: var(--font-sans);
      font-size: 7pt;
      font-weight: 500;
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid;
    }
    
    .chain-type-arrow {
      font-size: 8pt;
      color: var(--color-text-light);
    }

    /* ========================================
       FRAMEWORK STEPS
       ======================================== */
    .fw-step {
      display: flex;
      gap: 0.8em;
      margin: 0.6em 0;
      align-items: flex-start;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .fw-letter {
      font-family: var(--font-sans);
      font-size: 12pt;
      font-weight: 700;
      width: 2em;
      height: 2em;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      flex-shrink: 0;
    }
    
    .fw-step-body {
      flex: 1;
      min-width: 0;
      padding-top: 0.2em;
    }
    
    .fw-step-label {
      font-size: 9pt;
      margin-bottom: 0.15em;
    }
    
    .fw-step-example {
      font-size: 8pt;
      font-family: var(--font-mono);
      color: var(--color-text-muted);
    }

    /* ========================================
       PRINCIPLES LIST
       ======================================== */
    .principle-item {
      display: flex;
      align-items: center;
      gap: 0.6em;
      padding: 0.4em 0;
      font-size: 9pt;
      border-bottom: 1px solid var(--color-border);
    }
    
    .principle-item:last-child {
      border-bottom: none;
    }
    
    .principle-icon {
      font-size: 11pt;
      flex-shrink: 0;
    }

    /* ========================================
       VERSION DIFF
       ======================================== */
    .version-block {
      margin: 0.6em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .version-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 0.3em;
    }
    
    .version-label {
      font-family: var(--font-sans);
      font-size: 9pt;
      font-weight: 600;
    }
    
    .version-note {
      font-size: 7.5pt;
      color: var(--color-text-light);
      font-style: italic;
    }

    /* ========================================
       JAILBREAK EXAMPLES
       ======================================== */
    .jailbreak-example {
      margin: 0.8em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .jailbreak-name {
      font-family: var(--font-sans);
      font-size: 9pt;
      margin-bottom: 0.4em;
    }

    /* ========================================
       PROMPT BREAKDOWN
       ======================================== */
    .prompt-breakdown {
      margin: 1.5em 0;
      padding: 1.5em 1em 1em 1em;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 9pt;
      line-height: 2.2;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .pb-segment {
      display: inline;
      position: relative;
      white-space: nowrap;
    }
    
    .pb-label {
      font-family: var(--font-sans);
      font-size: 7pt;
      font-weight: 600;
      display: block;
      margin-bottom: -2px;
    }
    
    .pb-text {
      padding: 1px 4px;
      border-radius: 2px;
    }

    /* ========================================
       SPECIFICITY SPECTRUM
       ======================================== */
    .spectrum-level {
      margin: 0.6em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .spectrum-header {
      display: flex;
      align-items: center;
      gap: 0.6em;
      margin-bottom: 0.3em;
    }
    
    .spectrum-badge {
      font-family: var(--font-sans);
      font-size: 7.5pt;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
    }
    
    .spectrum-bar-wrap {
      flex: 1;
      height: 4px;
      background: var(--color-bg-muted);
      border-radius: 2px;
      overflow: hidden;
    }
    
    .spectrum-bar {
      display: block;
      height: 100%;
      border-radius: 2px;
    }
    
    .spectrum-level .prompt-code {
      margin: 0.2em 0;
      font-size: 8pt;
      padding: 0.6em 0.8em;
    }

    /* ========================================
       IMAGE / VIDEO PROMPT BUILDER
       ======================================== */
    .image-category {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.4em;
      margin: 0.5em 0;
      font-size: 8.5pt;
    }
    
    .image-cat-label {
      font-family: var(--font-sans);
      font-weight: 600;
      min-width: 6em;
      font-size: 8.5pt;
    }
    
    .image-option {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 8pt;
      background: var(--color-bg-muted);
      border: 1px solid transparent;
    }
    
    .image-example {
      margin: 0.6em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .image-example .prompt-code {
      margin: 0.3em 0;
    }
    
    .image-example .demo-note {
      margin: 0.2em 0;
    }

    .diffusion-steps {
      margin: 0.5em 0;
      padding-left: 0.5em;
    }

    .diffusion-step {
      font-size: 8.5pt;
      padding: 0.25em 0;
      color: var(--color-text-muted);
    }

    /* ========================================
       CODE EDITOR
       ======================================== */
    .code-editor-box {
      border: 1px solid #3c3c3c;
      border-radius: 6px;
      overflow: hidden;
      margin: 1.2em 0;
    }
    
    .code-editor-header {
      display: flex;
      align-items: center;
      gap: 0.6em;
      padding: 0.5em 0.8em;
      background: #252526;
      border-bottom: 1px solid #3c3c3c;
      font-size: 8pt;
    }
    
    .code-editor-dots {
      display: flex;
      gap: 4px;
    }
    
    .code-editor-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      ${PRINT_READY ? 'background: #999 !important;' : ''}
    }
    
    .code-editor-filename {
      font-family: var(--font-mono);
      color: #ccc;
      margin-left: 0.4em;
    }
    
    .code-editor-lang {
      margin-left: auto;
      text-transform: uppercase;
      color: #6e6e6e;
      font-family: var(--font-sans);
    }
    
    .code-editor-box .prompt-code {
      margin: 0;
      border-radius: 0;
    }

    /* ========================================
       CONTEXT BLOCKS
       ======================================== */
    .context-block {
      padding: 0.6em 0.8em;
      border-radius: 4px;
      margin: 0.4em 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .context-block-on {
      background: var(--color-bg-subtle);
      border: 1px solid var(--color-border);
    }
    
    .context-block-off {
      background: var(--color-bg-muted);
      opacity: 0.5;
      border: 1px dashed var(--color-border);
    }

    /* ========================================
       PROMPT BUILDER
       ======================================== */
    .builder-field {
      margin: 0.8em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .builder-field-label {
      font-family: var(--font-sans);
      font-size: 9pt;
      font-weight: 600;
      margin-bottom: 0.15em;
    }
    
    .builder-field-hint {
      font-size: 7.5pt;
      color: var(--color-text-light);
      font-style: italic;
      margin-bottom: 0.3em;
    }
    
    .builder-field-input {
      font-family: var(--font-mono);
      font-size: 8pt;
      color: var(--color-text-light);
      padding: 0.5em 0.6em;
      border: 1px dashed var(--color-border);
      border-radius: 4px;
      min-height: 2em;
      background: white;
    }

    /* ========================================
       INTERACTIVE NOTICE
       ======================================== */
    .interactive-notice {
      font-family: var(--font-sans);
      font-size: 8pt;
      color: var(--color-accent);
      background: linear-gradient(135deg, #faf5ff, #f3e8ff);
      border: 1px dashed var(--color-accent-light);
      border-radius: 4px;
      padding: 0.6em 1em;
      margin: 0.8em 0;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* ========================================
       HORIZONTAL RULES & IMAGES
       ======================================== */
    /* ========================================
       INLINE SVG ICONS (print-ready mode)
       ======================================== */
    .ico {
      width: 14px;
      height: 14px;
      display: inline-block;
      vertical-align: -2px;
      margin-right: 3px;
    }
    
    .ico-sm {
      width: 10px;
      height: 10px;
      display: inline-block;
      vertical-align: -1px;
      margin-right: 2px;
    }

    /* ========================================
       ENDNOTES / FOOTNOTES
       ======================================== */
    .fn-ref {
      font-family: var(--font-sans);
      font-size: 7pt;
      color: var(--color-accent);
      vertical-align: super;
      line-height: 0;
      margin-left: 1px;
    }
    
    .fn-section {
      margin-top: 2em;
      padding-top: 1em;
      border-top: 1px solid var(--color-border);
      page-break-inside: avoid;
    }
    
    .fn-title {
      font-family: var(--font-sans);
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-light);
      margin-bottom: 0.5em;
    }
    
    .fn-item {
      font-size: 7.5pt;
      line-height: 1.5;
      margin-bottom: 0.2em;
      word-break: break-all;
    }
    
    .fn-num {
      font-family: var(--font-sans);
      font-weight: 600;
      color: var(--color-accent);
      min-width: 1.5em;
      display: inline-block;
    }
    
    .fn-url {
      font-family: var(--font-mono);
      color: var(--color-text-muted);
    }
    
    blockquote {
      margin: 1.2em 0;
      padding: 0.6em 1em;
      border-left: 3px solid var(--color-border-dark);
      color: var(--color-text-muted);
      font-style: italic;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    blockquote p {
      margin: 0;
      text-indent: 0;
    }
    
    hr {
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 2em 0;
    }
    
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 1em 0;
    }
    
    /* ========================================
       BACK MATTER
       ======================================== */
    .back-matter {
      page-break-before: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 100vh;
      padding: 3em 2em;
    }
    
    .back-matter h2 {
      font-family: var(--font-heading);
      font-size: 18pt;
      font-weight: 700;
      border: none;
      margin-bottom: 0.8em;
    }
    
    .back-matter p {
      text-align: left;
      font-size: 10pt;
    }
    
    .back-matter ul {
      list-style: none;
      padding: 0;
      margin: 1.2em 0;
    }
    
    .back-matter li {
      font-size: 10pt;
      margin-bottom: 0.4em;
      padding-left: 1.2em;
      position: relative;
    }
    
    .back-matter li::before {
      content: "—";
      position: absolute;
      left: 0;
      color: var(--color-accent);
    }
    
    .colophon {
      font-size: 7.5pt;
      color: var(--color-text-light);
      margin-top: 4em;
      padding-top: 1.5em;
      border-top: 1px solid var(--color-border);
    }
    
    /* ========================================
       HALF TITLE PAGE (before TOC)
       ======================================== */
    .half-title {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
    }
    
    .half-title h1 {
      font-family: var(--font-heading);
      font-size: 18pt;
      font-weight: 600;
      color: var(--color-text);
      border: none;
      margin: 0;
    }
    
    .half-title p {
      text-align: center;
      font-size: 9pt;
      color: var(--color-text-light);
      margin-top: 0.5em;
    }
    
    /* ========================================
       PAGE BREAKS
       ======================================== */
    .page-break {
      page-break-after: always;
    }
    
    /* ========================================
       PRINT OPTIMIZATIONS
       ======================================== */
    @media print {
      body {
        font-size: 10pt;
      }
      
      /* Only new parts get page breaks */
      .chapter-new-part {
        page-break-before: always;
      }
      
      pre, .code-block, .prompt-code {
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      
      a {
        text-decoration: none;
        border-bottom: none;
      }
      
      /* Small elements: avoid page breaks inside */
      .callout,
      .info-item,
      .checklist,
      .interactive-notice,
      .chain-type-card,
      .prompt-breakdown,
      .chapter-opener,
      .fw-step,
      .iteration-step,
      .version-block,
      .builder-field,
      .context-block,
      .image-example,
      .jailbreak-example,
      .compare-box,
      .fn-section {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      
      /* Large elements: ALLOW page breaks inside to avoid huge gaps.
         These can be multi-page so forcing avoid wastes space. */
      /* .demo-box, .chain-box, .exercise-box, .code-editor-box — intentionally no avoid */
      
      /* Keep headings with following content */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
        break-after: avoid;
      }
      
      /* Ensure cover and half-title use full pages */
      .cover, .half-title {
        page-break-after: always;
      }
    }
    
    /* ========================================
       RTL SUPPORT
       ======================================== */
    [dir="rtl"] {
      text-align: right;
    }
    
    [dir="rtl"] p {
      text-align: right;
    }
    
    [dir="rtl"] p + p {
      text-indent: 0;
    }
    
    [dir="rtl"] .tryit-box {
      border-left: 1px solid #e9d5ff;
      border-right: 4px solid var(--color-accent);
      border-radius: 6px 0 0 6px;
    }
    
    [dir="rtl"] ul, [dir="rtl"] ol {
      padding-left: 0;
      padding-right: 1.5em;
    }
    
    [dir="rtl"] .toc-chapter {
      padding-left: 0;
      padding-right: 1em;
    }
    
    [dir="rtl"] .chapter-opener {
      flex-direction: row-reverse;
    }
    ${PRINT_READY ? `
    /* ========================================
       PRINT-READY OVERRIDES
       B&W grayscale + bleed extensions
       ======================================== */
    
    /* Print: no border radius anywhere */
    * {
      border-radius: 0 !important;
    }
    
    /* Print: remove outer borders from interactive containers */
    .demo-box,
    .exercise-box,
    .tryit-box,
    .quiz-box,
    .chain-box,
    .code-editor-box,
    .checklist,
    .prompt-breakdown,
    .compare-box {
      border: none !important;
      border-top: 1px solid #ccc !important;
      border-bottom: 1px solid #ccc !important;
      background: transparent !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      margin-top: 1.2em !important;
      margin-bottom: 1.2em !important;
      padding-top: 0.8em !important;
      padding-bottom: 0.8em !important;
    }
    
    /* Nested items inside bordered containers: no borders */
    .compare-item,
    .chain-type-card,
    .info-item,
    .chain-step-item,
    .context-block,
    .iteration-step,
    .version-block,
    .temp-level,
    .image-example,
    .jailbreak-example,
    .fw-step,
    .builder-field,
    .prediction-step {
      border: none !important;
      background: transparent !important;
    }
    
    /* Code blocks: no bg, no border, black text */
    pre, .code-block, .prompt-code {
      background: transparent !important;
      color: #000000 !important;
      border: none !important;
    }
    pre code, .code-block code {
      color: #000000 !important;
      background: transparent !important;
    }
    .code-editor-box {
      border: none !important;
    }
    .code-editor-header {
      background: transparent !important;
      border: none !important;
    }
    .code-editor-filename { color: #333 !important; }
    .code-editor-lang { color: #666 !important; }
    
    /* TryIt: no border in print */
    
    /* Callouts: all white with gray left border */
    .callout, .callout-info, .callout-warning, .callout-tip, .callout-example {
      background: #f2f2f2 !important;
      border: none !important;
      padding: 1em 1.2em !important;
    }
    
    /* Inline code: no bg */
    code {
      color: #000 !important;
      background: transparent !important;
    }
    
    /* Exercise elements */
    .exercise-header {
      color: #333 !important;
    }
    .exercise-hint {
      color: #333 !important;
    }
    .exercise-answers {
      border-top: none !important;
    }
    
    /* Prompt code error variant */
    .prompt-code-error {
      background: #fff !important;
      border-color: #999 !important;
    }
    
    /* Quiz: white */
    /* Info items, chain cards: no bg */
    .info-item {
      background: transparent !important;
    }
    .chain-type-card {
      border: none !important;
      background: transparent !important;
    }
    
    /* Compare boxes: no bg, no border in print */
    
    /* Cover and chapter rules: black */
    .cover-rule {
      background: #000000 !important;
    }
    .chapter-rule {
      background: #000000 !important;
    }
    
    /* Chain elements: grayscale */
    .chain-step-output {
      background: #f2f2f2 !important;
      border-color: #cccccc !important;
    }
    .chain-step-prompt {
      background: #f2f2f2 !important;
    }
    
    /* Iteration steps */
    .iteration-step {
      background: #f2f2f2 !important;
    }
    .iteration-output {
      background: #ffffff !important;
    }
    
    /* Temperature levels */
    .temp-level {
      background: #f2f2f2 !important;
    }
    
    /* Context blocks */
    .context-block-on {
      background: #ffffff !important;
      border-color: #cccccc !important;
    }
    .context-block-off {
      background: #f2f2f2 !important;
      border-color: #cccccc !important;
    }
    
    /* Builder fields */
    .builder-field-input {
      background: #ffffff !important;
      border-color: #cccccc !important;
    }
    
    /* Prompt breakdown segments: grayscale */
    .pb-text {
      background: #f2f2f2 !important;
      border-bottom-color: #000 !important;
    }
    .pb-label {
      color: #333 !important;
    }
    
    /* Spectrum badges: grayscale */
    .spectrum-badge {
      background: #333 !important;
      color: #fff !important;
    }
    .spectrum-bar {
      background: #333 !important;
    }
    
    /* Framework letters: grayscale */
    .fw-letter {
      background: #f2f2f2 !important;
      border-color: #cccccc !important;
    }
    
    /* Image/video option pills */
    .image-option {
      background: #f2f2f2 !important;
      border-color: #ccc !important;
    }
    
    /* Footnote refs */
    .fn-ref {
      color: #000 !important;
    }
    .fn-num {
      color: #000 !important;
    }
    
    /* Blockquotes */
    blockquote {
      border-left-color: #999 !important;
      color: #333 !important;
    }
    
    /* Interactive notice */
    .interactive-notice {
      background: #f2f2f2 !important;
      border-color: #ccc !important;
      color: #333 !important;
    }
    
    /* Links */
    a {
      color: #000 !important;
    }
    
    /* Print: avoid breaking interactive elements across pages */
    .chapter-opener,
    .tryit-box,
    .quiz-box,
    .callout,
    .demo-box,
    .exercise-box,
    .chain-box,
    .chain-type-card,
    .code-editor-box,
    .compare-box,
    .info-grid,
    .prompt-breakdown,
    .chain-step-item,
    .fw-step,
    .iteration-step,
    .version-block,
    .builder-field,
    .context-block,
    .image-example,
    .jailbreak-example,
    blockquote {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    ` : ''}
  </style>
</head>
<body>
  
  <!-- Cover Page -->
  <div class="cover">
    <div class="cover-rule"></div>
    <h1>${title}</h1>
    <p class="subtitle">${subtitle}</p>
    <div class="cover-author">
      <img class="cover-avatar" src="https://github.com/f.png" alt="Fatih Kadir Akın" />
      <div class="cover-author-info">
        <span class="author-name">Fatih Kadir Akın</span>
        <span class="author-desc">Creator of prompts.chat, GitHub Star</span>
      </div>
    </div>
    <p class="url">${SITE_URL}/book</p>
  </div>
  
  <!-- Half Title -->
  <div class="half-title">
    <h1>${title}</h1>
    <p>${SITE_URL}</p>
  </div>

  <!-- Table of Contents -->
  <div class="toc">
    <h2 class="toc-title">${tocTitle}</h2>
    ${parts.map(part => `
      <div class="toc-part">${translatePart(part.title)}</div>
      ${part.chapters.map(ch => `
        <div class="toc-chapter">
          <a href="#${ch.slug}">${translateChapter(ch.slug, ch.title)}</a>
          <span class="toc-dots"></span>
        </div>
      `).join('')}
    `).join('')}
  </div>
  
  <!-- Chapters -->
  ${chaptersHtml}
  
  <!-- Back Matter -->
  <div class="back-matter">
    <h2>Thank You for Reading</h2>
    <p>This book was designed as a companion to <strong>${SITE_URL}/book</strong>, where you can experience the full interactive version:</p>
    <ul>
      <li>Try every prompt directly in your browser</li>
      <li>Interactive quizzes with instant feedback</li>
      <li>Live demos and hands-on coding tools</li>
      <li>Available in 17+ languages</li>
    </ul>
    <p style="margin-top: 1.5em;">If you found this book helpful, consider sharing it with others or contributing to the open-source project on GitHub.</p>
    <div class="colophon">
      <p>${title}</p>
      <p>© ${new Date().getFullYear()} Fatih Kadir Akın — prompts.chat</p>
      <p style="margin-top: 0.6em;">
        Set in Palatino and Helvetica Neue. 6″ × 9″
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const generateAll = args.includes('--all');
  const requestedLocale = args.find(arg => !arg.startsWith('--')) || 'en';
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const availableLocales = getAvailableLocales();
  const localesToGenerate = generateAll ? availableLocales : [requestedLocale];
  
  console.log('📚 The Interactive Book of Prompting - PDF Generator\n');
  
  if (!generateAll && !availableLocales.includes(requestedLocale)) {
    console.error(`❌ Locale '${requestedLocale}' not found.`);
    console.log(`Available locales: ${availableLocales.join(', ')}`);
    process.exit(1);
  }
  
  for (const locale of localesToGenerate) {
    console.log(`\n📖 Generating PDF for locale: ${locale}`);
    
    // Process all chapters
    const chapters: ProcessedChapter[] = [];
    
    // Load locale data and messages for this locale
    const localeData = getLocaleData(locale);
    const messages = loadMessages(locale);
    
    for (const part of parts) {
      for (const chapter of part.chapters) {
        const processed = processChapter(locale, chapter, localeData, messages);
        if (processed) {
          chapters.push(processed);
          console.log(`  ✓ ${chapter.title}`);
        }
      }
    }
    
    if (chapters.length === 0) {
      console.log(`  ⚠ No chapters found for ${locale}, skipping...`);
      continue;
    }
    
    // Generate HTML
    const html = generateHtmlDocument(chapters, locale, messages);
    
    // Write HTML file (can be converted to PDF with browser print or puppeteer)
    const suffix = PRINT_READY ? '-print' : '';
    const htmlPath = path.join(OUTPUT_DIR, `book-${locale}${suffix}.html`);
    // Apply grayscale conversion to the entire document for print-ready mode
    const finalHtml = convertStylesToGrayscale(html);
    fs.writeFileSync(htmlPath, finalHtml, 'utf-8');
    console.log(`\n  📄 HTML saved to: ${htmlPath}`);
    
    console.log(`\n  ℹ️  To generate PDF:`);
    console.log(`     1. Open ${htmlPath} in a browser`);
    console.log(`     2. Press Cmd/Ctrl + P to print`);
    console.log(`     3. Select "Save as PDF"`);
    console.log(`     Or use: npx puppeteer print ${htmlPath} book-${locale}.pdf`);
  }
  
  console.log('\n✅ Done!\n');
}

// Run
main().catch(console.error);
