import { atom } from 'jotai';

import type { MenuConfig } from '@/libs/menu-config';
import { DEFAULT_MENU_CONFIG } from '@/libs/menu-config';
import * as storage from '@/libs/storage';
import type { Resolution, Rotation } from '@/types.ts';

type VideoState = 'disconnected' | 'connecting' | 'connected';
type SerialState = 'notSupported' | 'disconnected' | 'connecting' | 'connected';

export const resolutionAtom = atom<Resolution>({
  width: 1920,
  height: 1080
});

export const videoScaleAtom = atom<number>(0); // 0 = auto (fit to window)

export const videoRotationAtom = atom<Rotation>(0);

export const videoDeviceIdAtom = atom('');
export const videoStateAtom = atom<VideoState>('disconnected');

export const serialStateAtom = atom<SerialState>('disconnected');

// Menu configuration atom - initialized from storage
export const menuConfigAtom = atom<MenuConfig>(storage.getMenuConfig() ?? DEFAULT_MENU_CONFIG);
