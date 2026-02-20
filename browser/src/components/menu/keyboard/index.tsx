import { useState } from 'react';
import { Popover } from 'antd';
import { useAtomValue } from 'jotai';
import { KeyboardIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { menuConfigAtom } from '@/jotai/device';
import type { KeyboardSubItemId } from '@/libs/menu-config';

import { MenuTooltip } from '../menu-tooltip';
import { LoginHelper } from './login-helper.tsx';
import { Paste } from './paste.tsx';
import { PasteWithDialog } from './paste-dialog.tsx';
import { Shortcuts } from './shortcuts';
import { VirtualKeyboard } from './virtual-keyboard.tsx';

const SUB_COMPONENTS: Record<KeyboardSubItemId, React.FC> = {
  'keyboard.paste': Paste,
  'keyboard.pasteDialog': PasteWithDialog,
  'keyboard.loginHelper': LoginHelper,
  'keyboard.virtualKeyboard': VirtualKeyboard,
  'keyboard.shortcuts': Shortcuts,
};

export const Keyboard = () => {
  const { t } = useTranslation();
  const menuConfig = useAtomValue(menuConfigAtom);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const content = (
    <div className="flex flex-col space-y-0.5">
      {menuConfig.subMenus.keyboard.map((itemId) => {
        const Component = SUB_COMPONENTS[itemId];
        return Component ? <Component key={itemId} /> : null;
      })}
    </div>
  );

  return (
    <MenuTooltip title={t('menu.keyboard', 'Keyboard')}>
      <Popover
        content={content}
        placement="bottomLeft"
        trigger="click"
        arrow={false}
        open={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
      >
        <div className="flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded text-neutral-300 hover:bg-neutral-700/70 hover:text-white">
          <KeyboardIcon size={18} />
        </div>
      </Popover>
    </MenuTooltip>
  );
};
