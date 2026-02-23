import { useEffect, useState } from 'react';
import { Divider, Popover } from 'antd';
import { CommandIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ScrollArea } from '@/components/ui/scroll-area';
import * as storage from '@/libs/storage';

import { Recorder } from './recorder.tsx';
import { Shortcut } from './shortcut.tsx';
import type { Shortcut as ShortcutInterface } from './types.ts';

const defaultShortcuts: ShortcutInterface[] = [
  {
    keys: [
      { code: 'MetaLeft', label: 'Win' },
      { code: 'Tab', label: 'Tab' }
    ]
  },
  {
    keys: [
      { code: 'ControlLeft', label: 'Ctrl' },
      { code: 'AltLeft', label: 'Alt' },
      { code: 'Delete', label: 'Del' }
    ]
  },
  {
    keys: [
      { code: 'ControlLeft', label: 'Ctrl' },
      { code: 'ShiftLeft', label: 'Shift' },
      { code: 'Insert', label: 'Ins' }
    ]
  }
];

interface ShortcutsContentProps {
  onAction?: () => void;
}

// Content component for direct use in promoted items
export const ShortcutsContent = ({ onAction }: ShortcutsContentProps = {}) => {
  const [customShortcuts, setCustomShortcuts] = useState<ShortcutInterface[]>([]);
  const [, setIsRecording] = useState(false);

  useEffect(() => {
    const shortcuts = storage.getShortcuts();
    if (!shortcuts) return;
    setCustomShortcuts(JSON.parse(shortcuts));
  }, []);

  function addShortcut(shortcut: ShortcutInterface): void {
    const shortcuts = [...customShortcuts, shortcut];
    setCustomShortcuts(shortcuts);
    storage.setShortcuts(JSON.stringify(shortcuts));
  }

  function delShortcut(index: number): void {
    const shortcuts = customShortcuts.filter((_, i) => i !== index);
    setCustomShortcuts(shortcuts);
    storage.setShortcuts(JSON.stringify(shortcuts));
  }

  return (
    <ScrollArea className="max-w-[400px] [&>[data-radix-scroll-area-viewport]]:max-h-[350px]">
      {customShortcuts.length > 0 && (
        <>
          {customShortcuts.map((shortcut, index) => (
            <Shortcut key={index} shortcut={shortcut} onAction={onAction} />
          ))}
          <Divider style={{ margin: '5px 0 5px 0' }} />
        </>
      )}
      {defaultShortcuts.map((shortcut, index) => (
        <Shortcut key={index} shortcut={shortcut} onAction={onAction} />
      ))}
      <Divider style={{ margin: '5px 0 5px 0' }} />
      <Recorder
        shortcuts={customShortcuts}
        addShortcut={addShortcut}
        delShortcut={delShortcut}
        setIsRecording={setIsRecording}
      />
    </ScrollArea>
  );
};

export const Shortcuts = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording] = useState(false);

  function handleOpenChange(open: boolean): void {
    if (open) {
      setIsOpen(true);
      return;
    }
    if (isRecording) {
      return;
    }
    setIsOpen(false);
  }
  
  const closeMenu = () => setIsOpen(false);

  return (
    <Popover
      content={<ShortcutsContent onAction={closeMenu} />}
      trigger="hover"
      placement="rightTop"
      align={{ offset: [14, 0] }}
      open={isOpen}
      onOpenChange={handleOpenChange}
      arrow={false}
    >
      <div className="flex h-[32px] cursor-pointer items-center space-x-2 rounded px-3 text-neutral-300 hover:bg-neutral-700/50">
        <CommandIcon size={16} />
        <span>{t('keyboard.shortcut.title')}</span>
      </div>
    </Popover>
  );
};
