import { Select } from 'antd';
import { useAtom } from 'jotai';
import { atom } from 'jotai';
import { MonitorIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as storage from '@/libs/storage';

export type RenderingMode = 'auto' | 'pixelated';

// Atom for video rendering mode
export const renderingModeAtom = atom(storage.getRenderingMode());

export const CrispRenderingSetting = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useAtom(renderingModeAtom);

  function handleChange(value: RenderingMode) {
    setMode(value);
    storage.setRenderingMode(value);
  }

  return (
    <div className="flex h-[32px] items-center space-x-2 rounded px-3 text-neutral-300">
      <MonitorIcon size={16} />
      <span className="text-sm">{t('settings.renderingMode', 'Rendering')}:</span>
      <Select
        size="small"
        value={mode}
        onChange={handleChange}
        style={{ width: 110 }}
        options={[
          { value: 'auto', label: t('settings.rendering.smooth', 'Smooth') },
          { value: 'pixelated', label: t('settings.rendering.pixelated', 'Pixelated') },
        ]}
      />
    </div>
  );
};
