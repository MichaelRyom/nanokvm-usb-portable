// Dynamic keyboard layout detection using browser's Keyboard API
// This allows paste to work correctly regardless of keyboard layout
//
// Strategy:
// 1. Use browser's Keyboard.getLayoutMap() to detect YOUR keyboard layout
// 2. For "same layout" mode: assume target has same layout as you
// 3. For "different layout" mode: user specifies target layout
//
// When local and target layouts match, paste will work correctly
// because we map character -> physical key using YOUR layout

import { KeycodeMap } from './keymap';

export interface KeyMapping {
  code: number;      // HID keycode
  shift?: boolean;   // Requires Shift
  altGr?: boolean;   // Requires AltGr (Right Alt)
  deadKey?: boolean; // Is a dead key (needs space after to produce standalone char)
}

export type LayoutMap = Record<string, KeyMapping>;

// Cache for the detected layout
let cachedLayoutMap: LayoutMap | null = null;
let layoutDetectionPromise: Promise<LayoutMap> | null = null;

// Map from DOM key code (e.g., "KeyA") to HID keycode
function domCodeToHid(domCode: string): number | undefined {
  return KeycodeMap[domCode];
}

// Fallback US QWERTY layout when browser API is unavailable
function getFallbackLayout(): LayoutMap {
  const layout: LayoutMap = {};

  // Basic ASCII letters
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const letterCodes = [0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
                       0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
                       0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d];

  for (let i = 0; i < letters.length; i++) {
    layout[letters[i]] = { code: letterCodes[i] };
    layout[letters[i].toUpperCase()] = { code: letterCodes[i], shift: true };
  }

  // Numbers (US layout - number row)
  const numbers = '1234567890';
  const numCodes = [0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27];
  for (let i = 0; i < numbers.length; i++) {
    layout[numbers[i]] = { code: numCodes[i] };
  }

  // Basic punctuation (US layout)
  layout[' '] = { code: 0x2c };
  layout['\t'] = { code: 0x2b };
  layout['\n'] = { code: 0x28 };
  layout['\r'] = { code: 0x28 };
  layout['-'] = { code: 0x2d };
  layout['='] = { code: 0x2e };
  layout['['] = { code: 0x2f };
  layout[']'] = { code: 0x30 };
  layout['\\'] = { code: 0x31 };
  layout[';'] = { code: 0x33 };
  layout["'"] = { code: 0x34 };
  layout['`'] = { code: 0x35 };
  layout[','] = { code: 0x36 };
  layout['.'] = { code: 0x37 };
  layout['/'] = { code: 0x38 };

  return layout;
}

// Build shifted character mappings based on detected unshifted chars
// This assumes Shift+key produces a related character (works for same-layout scenarios)
function buildShiftedMappings(layoutMap: LayoutMap): void {
  // For each unshifted punctuation, try to find shifted version on same key
  // These are common patterns that work across many layouts
  const shiftPairs: [string, string][] = [
    ['.', ':'],  // Period -> Colon (works for Danish, German, etc.)
    [',', ';'],  // Comma -> Semicolon
    ['-', '_'],  // Minus -> Underscore (varies by layout)
  ];

  for (const [unshifted, shifted] of shiftPairs) {
    if (layoutMap[unshifted] && !layoutMap[shifted]) {
      layoutMap[shifted] = { code: layoutMap[unshifted].code, shift: true };
    }
  }
}

// Baseline punctuation - only unshifted chars that are consistent across layouts
function getBasePunctuation(): LayoutMap {
  return {
    // Basic controls
    ' ': { code: 0x2c },
    '\t': { code: 0x2b },
    '\n': { code: 0x28 },
    '\r': { code: 0x28 },
    
    // Numbers are usually consistent
    '1': { code: 0x1e }, '2': { code: 0x1f }, '3': { code: 0x20 },
    '4': { code: 0x21 }, '5': { code: 0x22 }, '6': { code: 0x23 },
    '7': { code: 0x24 }, '8': { code: 0x25 }, '9': { code: 0x26 },
    '0': { code: 0x27 },
  };
}

// Detect the current keyboard layout from the browser
async function detectBrowserLayout(): Promise<LayoutMap> {
  // Start with minimal baseline
  const layoutMap: LayoutMap = { ...getBasePunctuation() };

  // Add letters (consistent across layouts)
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const letterCodes = [0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
                       0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
                       0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d];
  for (let i = 0; i < letters.length; i++) {
    layoutMap[letters[i]] = { code: letterCodes[i] };
    layoutMap[letters[i].toUpperCase()] = { code: letterCodes[i], shift: true };
  }

  // Try to detect layout from browser API
  if ('keyboard' in navigator && 'getLayoutMap' in (navigator as any).keyboard) {
    try {
      const keyboard = (navigator as any).keyboard;
      const browserLayoutMap = await keyboard.getLayoutMap();

      // Override with detected layout (accurate for user's actual keyboard)
      browserLayoutMap.forEach((char: string, domCode: string) => {
        const hidCode = domCodeToHid(domCode);
        if (hidCode !== undefined && char && char.length === 1) {
          layoutMap[char] = { code: hidCode };

          // Also add uppercase for letters
          if (char.match(/[a-z]/i)) {
            const upper = char.toUpperCase();
            const lower = char.toLowerCase();
            if (upper !== lower) {
              layoutMap[lower] = { code: hidCode };
              layoutMap[upper] = { code: hidCode, shift: true };
            }
          }
        }
      });

      // Build shifted mappings based on detected layout
      buildShiftedMappings(layoutMap);

      console.log(`Detected keyboard layout with ${Object.keys(layoutMap).length} mappings`);
    } catch (err) {
      console.warn('Failed to detect keyboard layout:', err);
    }
  } else {
    console.warn('Keyboard API not available, using baseline layout');
  }

  return layoutMap;
}

// Event-based layout learning: call this when user types to learn shifted/altgr chars
// This fills in gaps the browser API doesn't provide (like shifted number row chars)
export function learnFromKeyEvent(event: KeyboardEvent): void {
  if (!cachedLayoutMap) return;

  const char = event.key;
  if (char.length !== 1) return; // Only single characters

  const hidCode = domCodeToHid(event.code);
  if (hidCode === undefined) return;

  // Skip if we already have this exact mapping
  if (cachedLayoutMap[char]) return;

  const shift = event.shiftKey;
  const altGr = event.getModifierState('AltGraph');

  cachedLayoutMap[char] = {
    code: hidCode,
    shift: shift || undefined,
    altGr: altGr || undefined,
  };

  console.log(`Learned: '${char}' -> HID ${hidCode.toString(16)} (shift=${shift}, altGr=${altGr})`);
}

// Get the current layout (auto-detected from browser)
export async function getDetectedLayout(): Promise<LayoutMap> {
  if (cachedLayoutMap) {
    return cachedLayoutMap;
  }

  if (layoutDetectionPromise) {
    return layoutDetectionPromise;
  }

  layoutDetectionPromise = detectBrowserLayout().then(layout => {
    cachedLayoutMap = layout;
    return layout;
  });

  return layoutDetectionPromise;
}

// Get cached layout synchronously (may be incomplete if not yet detected)
export function getCachedLayout(): LayoutMap | null {
  return cachedLayoutMap;
}

// Initialize layout detection (call early in app startup)
export function initLayoutDetection(): void {
  getDetectedLayout().catch(err => {
    console.error('Layout detection failed:', err);
  });
}

// Mode selection
export type LayoutMode = 'auto' | 'manual';

export interface LayoutConfig {
  mode: LayoutMode;
  manualLayoutId?: string;  // Only used when mode is 'manual'
}

// Predefined layouts for manual selection
const DANISH_LAYOUT: LayoutMap = {
  // Letters (same as US QWERTY positions)
  'a': { code: 0x04 }, 'A': { code: 0x04, shift: true },
  'b': { code: 0x05 }, 'B': { code: 0x05, shift: true },
  'c': { code: 0x06 }, 'C': { code: 0x06, shift: true },
  'd': { code: 0x07 }, 'D': { code: 0x07, shift: true },
  'e': { code: 0x08 }, 'E': { code: 0x08, shift: true },
  'f': { code: 0x09 }, 'F': { code: 0x09, shift: true },
  'g': { code: 0x0a }, 'G': { code: 0x0a, shift: true },
  'h': { code: 0x0b }, 'H': { code: 0x0b, shift: true },
  'i': { code: 0x0c }, 'I': { code: 0x0c, shift: true },
  'j': { code: 0x0d }, 'J': { code: 0x0d, shift: true },
  'k': { code: 0x0e }, 'K': { code: 0x0e, shift: true },
  'l': { code: 0x0f }, 'L': { code: 0x0f, shift: true },
  'm': { code: 0x10 }, 'M': { code: 0x10, shift: true },
  'n': { code: 0x11 }, 'N': { code: 0x11, shift: true },
  'o': { code: 0x12 }, 'O': { code: 0x12, shift: true },
  'p': { code: 0x13 }, 'P': { code: 0x13, shift: true },
  'q': { code: 0x14 }, 'Q': { code: 0x14, shift: true },
  'r': { code: 0x15 }, 'R': { code: 0x15, shift: true },
  's': { code: 0x16 }, 'S': { code: 0x16, shift: true },
  't': { code: 0x17 }, 'T': { code: 0x17, shift: true },
  'u': { code: 0x18 }, 'U': { code: 0x18, shift: true },
  'v': { code: 0x19 }, 'V': { code: 0x19, shift: true },
  'w': { code: 0x1a }, 'W': { code: 0x1a, shift: true },
  'x': { code: 0x1b }, 'X': { code: 0x1b, shift: true },
  'y': { code: 0x1c }, 'Y': { code: 0x1c, shift: true },
  'z': { code: 0x1d }, 'Z': { code: 0x1d, shift: true },
  
  // Danish specific letters
  'æ': { code: 0x33 }, 'Æ': { code: 0x33, shift: true },
  'ø': { code: 0x34 }, 'Ø': { code: 0x34, shift: true },
  'å': { code: 0x2f }, 'Å': { code: 0x2f, shift: true },
  
  // Number row
  '1': { code: 0x1e }, '!': { code: 0x1e, shift: true },
  '2': { code: 0x1f }, '"': { code: 0x1f, shift: true },
  '3': { code: 0x20 }, '#': { code: 0x20, shift: true },
  '4': { code: 0x21 }, '¤': { code: 0x21, shift: true },
  '5': { code: 0x22 }, '%': { code: 0x22, shift: true },
  '6': { code: 0x23 }, '&': { code: 0x23, shift: true },
  '7': { code: 0x24 }, '/': { code: 0x24, shift: true },
  '8': { code: 0x25 }, '(': { code: 0x25, shift: true },
  '9': { code: 0x26 }, ')': { code: 0x26, shift: true },
  '0': { code: 0x27 }, '=': { code: 0x27, shift: true },
  
  // Punctuation
  '+': { code: 0x2d }, '?': { code: 0x2d, shift: true },
  '´': { code: 0x2e, deadKey: true }, '`': { code: 0x2e, shift: true, deadKey: true },
  '¨': { code: 0x30, deadKey: true }, '^': { code: 0x30, shift: true, deadKey: true },
  "'": { code: 0x31 }, '*': { code: 0x31, shift: true },
  ',': { code: 0x36 }, ';': { code: 0x36, shift: true },
  '.': { code: 0x37 }, ':': { code: 0x37, shift: true },
  '-': { code: 0x38 }, '_': { code: 0x38, shift: true },
  '<': { code: 0x64 }, '>': { code: 0x64, shift: true },
  '½': { code: 0x35 }, '§': { code: 0x35, shift: true },
  
  // AltGr combinations
  '@': { code: 0x1f, altGr: true },
  '£': { code: 0x20, altGr: true },
  '$': { code: 0x21, altGr: true },
  '€': { code: 0x08, altGr: true },
  '{': { code: 0x24, altGr: true },
  '[': { code: 0x25, altGr: true },
  ']': { code: 0x26, altGr: true },
  '}': { code: 0x27, altGr: true },
  '|': { code: 0x2e, altGr: true },
  '~': { code: 0x30, altGr: true, deadKey: true },
  '\\': { code: 0x64, altGr: true },
  
  // Controls
  ' ': { code: 0x2c },
  '\t': { code: 0x2b },
  '\n': { code: 0x28 },
  '\r': { code: 0x28 },
};

const US_LAYOUT: LayoutMap = {
  // Letters
  'a': { code: 0x04 }, 'A': { code: 0x04, shift: true },
  'b': { code: 0x05 }, 'B': { code: 0x05, shift: true },
  'c': { code: 0x06 }, 'C': { code: 0x06, shift: true },
  'd': { code: 0x07 }, 'D': { code: 0x07, shift: true },
  'e': { code: 0x08 }, 'E': { code: 0x08, shift: true },
  'f': { code: 0x09 }, 'F': { code: 0x09, shift: true },
  'g': { code: 0x0a }, 'G': { code: 0x0a, shift: true },
  'h': { code: 0x0b }, 'H': { code: 0x0b, shift: true },
  'i': { code: 0x0c }, 'I': { code: 0x0c, shift: true },
  'j': { code: 0x0d }, 'J': { code: 0x0d, shift: true },
  'k': { code: 0x0e }, 'K': { code: 0x0e, shift: true },
  'l': { code: 0x0f }, 'L': { code: 0x0f, shift: true },
  'm': { code: 0x10 }, 'M': { code: 0x10, shift: true },
  'n': { code: 0x11 }, 'N': { code: 0x11, shift: true },
  'o': { code: 0x12 }, 'O': { code: 0x12, shift: true },
  'p': { code: 0x13 }, 'P': { code: 0x13, shift: true },
  'q': { code: 0x14 }, 'Q': { code: 0x14, shift: true },
  'r': { code: 0x15 }, 'R': { code: 0x15, shift: true },
  's': { code: 0x16 }, 'S': { code: 0x16, shift: true },
  't': { code: 0x17 }, 'T': { code: 0x17, shift: true },
  'u': { code: 0x18 }, 'U': { code: 0x18, shift: true },
  'v': { code: 0x19 }, 'V': { code: 0x19, shift: true },
  'w': { code: 0x1a }, 'W': { code: 0x1a, shift: true },
  'x': { code: 0x1b }, 'X': { code: 0x1b, shift: true },
  'y': { code: 0x1c }, 'Y': { code: 0x1c, shift: true },
  'z': { code: 0x1d }, 'Z': { code: 0x1d, shift: true },
  
  // Number row
  '1': { code: 0x1e }, '!': { code: 0x1e, shift: true },
  '2': { code: 0x1f }, '@': { code: 0x1f, shift: true },
  '3': { code: 0x20 }, '#': { code: 0x20, shift: true },
  '4': { code: 0x21 }, '$': { code: 0x21, shift: true },
  '5': { code: 0x22 }, '%': { code: 0x22, shift: true },
  '6': { code: 0x23 }, '^': { code: 0x23, shift: true },
  '7': { code: 0x24 }, '&': { code: 0x24, shift: true },
  '8': { code: 0x25 }, '*': { code: 0x25, shift: true },
  '9': { code: 0x26 }, '(': { code: 0x26, shift: true },
  '0': { code: 0x27 }, ')': { code: 0x27, shift: true },
  
  // Punctuation
  '-': { code: 0x2d }, '_': { code: 0x2d, shift: true },
  '=': { code: 0x2e }, '+': { code: 0x2e, shift: true },
  '[': { code: 0x2f }, '{': { code: 0x2f, shift: true },
  ']': { code: 0x30 }, '}': { code: 0x30, shift: true },
  '\\': { code: 0x31 }, '|': { code: 0x31, shift: true },
  ';': { code: 0x33 }, ':': { code: 0x33, shift: true },
  "'": { code: 0x34 }, '"': { code: 0x34, shift: true },
  '`': { code: 0x35 }, '~': { code: 0x35, shift: true },
  ',': { code: 0x36 }, '<': { code: 0x36, shift: true },
  '.': { code: 0x37 }, '>': { code: 0x37, shift: true },
  '/': { code: 0x38 }, '?': { code: 0x38, shift: true },
  
  // Controls
  ' ': { code: 0x2c },
  '\t': { code: 0x2b },
  '\n': { code: 0x28 },
  '\r': { code: 0x28 },
};

export const LAYOUTS: Record<string, { name: string; map: LayoutMap }> = {
  'auto': { name: 'Auto-detect', map: {} }, // Special case, uses detected layout
  'da': { name: 'Danish', map: DANISH_LAYOUT },
  'us': { name: 'US English', map: US_LAYOUT },
};

export function getLayout(config: LayoutConfig): LayoutMap {
  if (config.mode === 'auto') {
    return cachedLayoutMap ?? getFallbackLayout();
  }

  if (config.manualLayoutId && LAYOUTS[config.manualLayoutId]) {
    return LAYOUTS[config.manualLayoutId].map;
  }

  return cachedLayoutMap ?? getFallbackLayout();
}

// Get layout by ID (for paste function)
export function getLayoutById(layoutId: string): LayoutMap {
  if (layoutId === 'auto') {
    return cachedLayoutMap ?? getFallbackLayout();
  }
  return LAYOUTS[layoutId]?.map ?? cachedLayoutMap ?? getFallbackLayout();
}

// Simplified API for common use case (auto-detect, same layout on both sides)
export function getAutoLayout(): LayoutMap {
  return cachedLayoutMap ?? getFallbackLayout();
}
