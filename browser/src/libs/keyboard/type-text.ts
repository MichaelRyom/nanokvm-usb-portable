import { device } from '@/libs/device';
import { getLayoutById } from '@/libs/keyboard/layouts';
import { ModifierBits, KeycodeMap } from '@/libs/keyboard/keymap';
import { getTargetKeyboardLayout, getPasteSpeed } from '@/libs/storage';

export async function typeText(text: string): Promise<void> {
  const layoutId = getTargetKeyboardLayout();
  const delay = getPasteSpeed();
  const layout = getLayoutById(layoutId);
  const keyUpDelay = Math.ceil(delay / 2);

  for (const char of text) {
    const mapping = layout[char];
    if (!mapping) continue;

    let modifier = 0;
    if (mapping.shift) modifier |= ModifierBits.LeftShift;
    if (mapping.altGr) modifier |= ModifierBits.RightAlt;

    // For modified keys (Shift/AltGr), press modifier first, then key
    // This is more compatible with Windows login screen
    if (modifier !== 0) {
      // Press modifier first
      await device.sendKeyboardData([modifier, 0, 0, 0, 0, 0, 0, 0]);
      await new Promise((r) => setTimeout(r, Math.max(delay, 20)));
    }
    
    // Press key (with modifier held)
    await device.sendKeyboardData([modifier, 0, mapping.code, 0, 0, 0, 0, 0]);
    await new Promise((r) => setTimeout(r, delay));

    // Release key (modifier still held)
    if (modifier !== 0) {
      await device.sendKeyboardData([modifier, 0, 0, 0, 0, 0, 0, 0]);
      await new Promise((r) => setTimeout(r, Math.max(keyUpDelay, 15)));
    }
    
    // Release modifier
    await device.sendKeyboardData([0, 0, 0, 0, 0, 0, 0, 0]);
    if (mapping.altGr) {
      await new Promise((r) => setTimeout(r, keyUpDelay));
      await device.sendKeyboardData([0, 0, 0, 0, 0, 0, 0, 0]);
    }
    await new Promise((r) => setTimeout(r, keyUpDelay));

    // For dead keys, send space
    if (mapping.deadKey) {
      await device.sendKeyboardData([0, 0, 0x2c, 0, 0, 0, 0, 0]);
      await new Promise((r) => setTimeout(r, delay));
      await device.sendKeyboardData([0, 0, 0, 0, 0, 0, 0, 0]);
      await new Promise((r) => setTimeout(r, keyUpDelay));
    }
  }
}

export async function pressKey(code: string): Promise<void> {
  const hidCode = KeycodeMap[code];
  if (!hidCode) return;
  
  // Key down
  await device.sendKeyboardData([0, 0, hidCode, 0, 0, 0, 0, 0]);
  await new Promise((r) => setTimeout(r, 20));
  // Key up
  await device.sendKeyboardData([0, 0, 0, 0, 0, 0, 0, 0]);
  await new Promise((r) => setTimeout(r, 20));
}
