import { useState } from 'react';
import { Popover } from 'antd';
import { useSetAtom } from 'jotai';
import {
  MonitorIcon,
  RotateCwIcon,
  MaximizeIcon,
  VideoIcon,
  ClipboardIcon,
  ClipboardPasteIcon,
  KeyboardIcon,
  CommandIcon,
  MousePointerIcon,
  MousePointer2Icon,
  ArrowUpDownIcon,
  GaugeIcon,
  MousePointerClickIcon,
  LanguagesIcon,
  TypeIcon,
  TimerIcon,
  MessageSquareIcon,
  LayoutGridIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { isKeyboardOpenAtom } from '@/jotai/keyboard';
import { pasteStateAtom } from '@/components/paste-dialog';
import { getTargetKeyboardLayout } from '@/libs/storage';
import type { SubMenuItemId } from '@/libs/menu-config';
import { getSubMenuItemMeta } from '@/libs/menu-config';

import { MenuTooltip } from './menu-tooltip';

// Import existing components - they render as list items but work
import { Resolution } from './video/resolution';
import { Rotation } from './video/rotation';
import { Scale } from './video/scale';
import { Device } from './video/device';
import { pasteText } from './keyboard/paste';
import { ShortcutsContent } from './keyboard/shortcuts';
import { Style } from './mouse/style';
import { Mode } from './mouse/mode';
import { Direction } from './mouse/direction';
import { Speed } from './mouse/speed';
import { Jiggler } from './mouse/jiggler';
import { Language } from './settings/language';
import { KeyboardLayout } from './settings/keyboard-layout';
import { PasteSpeedSetting } from './settings/paste-speed';
import { TooltipsSetting } from './settings/tooltips';
import { MenuCustomization } from './settings/menu-customization';

// Icon mapping for each submenu item
const ITEM_ICONS: Record<SubMenuItemId, React.ReactNode> = {
  'video.resolution': <MonitorIcon size={18} />,
  'video.rotation': <RotateCwIcon size={18} />,
  'video.scale': <MaximizeIcon size={18} />,
  'video.device': <VideoIcon size={18} />,
  'keyboard.paste': <ClipboardIcon size={18} />,
  'keyboard.pasteDialog': <ClipboardPasteIcon size={18} />,
  'keyboard.virtualKeyboard': <KeyboardIcon size={18} />,
  'keyboard.shortcuts': <CommandIcon size={18} />,
  'mouse.style': <MousePointerIcon size={18} />,
  'mouse.mode': <MousePointer2Icon size={18} />,
  'mouse.direction': <ArrowUpDownIcon size={18} />,
  'mouse.speed': <GaugeIcon size={18} />,
  'mouse.jiggler': <MousePointerClickIcon size={18} />,
  'settings.language': <LanguagesIcon size={18} />,
  'settings.keyboardLayout': <TypeIcon size={18} />,
  'settings.pasteSpeed': <TimerIcon size={18} />,
  'settings.tooltips': <MessageSquareIcon size={18} />,
  'settings.menuCustomization': <LayoutGridIcon size={18} />,
};

// Components for popover items - rendered inside popover
const POPOVER_COMPONENTS: Partial<Record<SubMenuItemId, React.FC>> = {
  'video.resolution': Resolution,
  'video.rotation': Rotation,
  'video.scale': Scale,
  'video.device': Device,
  // keyboard.shortcuts handled specially below to pass onAction
  'mouse.style': Style,
  'mouse.mode': Mode,
  'mouse.direction': Direction,
  'mouse.speed': Speed,
  'mouse.jiggler': Jiggler,
  'settings.language': Language,
  'settings.keyboardLayout': KeyboardLayout,
  'settings.pasteSpeed': PasteSpeedSetting,
  'settings.tooltips': TooltipsSetting,
  'settings.menuCustomization': MenuCustomization,
};

interface PromotedSubMenuItemProps {
  itemId: SubMenuItemId;
}

export const PromotedSubMenuItem: React.FC<PromotedSubMenuItemProps> = ({ itemId }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const setIsKeyboardOpen = useSetAtom(isKeyboardOpenAtom);
  const setPasteState = useSetAtom(pasteStateAtom);
  
  const meta = getSubMenuItemMeta(itemId);
  if (!meta) return null;
  
  const icon = ITEM_ICONS[itemId];
  const label = t(meta.labelKey, meta.defaultLabel);
  const buttonClass = "flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded text-neutral-300 hover:bg-neutral-700/70 hover:text-white";
  
  // Handle direct action items
  if (itemId === 'keyboard.paste') {
    const handlePaste = async () => {
      if (isPasting) return;
      setIsPasting(true);
      try {
        const text = await navigator.clipboard.readText();
        if (text) await pasteText(text);
      } catch (e) {
        console.log(e);
      } finally {
        setIsPasting(false);
      }
    };
    
    return (
      <MenuTooltip title={label}>
        <div className={buttonClass} onClick={handlePaste}>
          {icon}
        </div>
      </MenuTooltip>
    );
  }
  
  if (itemId === 'keyboard.virtualKeyboard') {
    const toggleKeyboard = () => {
      setIsKeyboardOpen((prev) => !prev);
    };
    
    return (
      <MenuTooltip title={label}>
        <div className={buttonClass} onClick={toggleKeyboard}>
          {icon}
        </div>
      </MenuTooltip>
    );
  }
  
  if (itemId === 'keyboard.pasteDialog') {
    const openPasteDialog = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return;
        const layoutId = getTargetKeyboardLayout();
        setPasteState({
          isOpen: true,
          text,
          layoutId,
          isPasting: false,
          progress: 0,
          currentChar: 0,
          totalChars: text.length
        });
      } catch (e) {
        console.log(e);
      }
    };
    
    return (
      <MenuTooltip title={label}>
        <div className={buttonClass} onClick={openPasteDialog}>
          {icon}
        </div>
      </MenuTooltip>
    );
  }
  
  // Special handling for shortcuts to pass onAction callback
  if (itemId === 'keyboard.shortcuts') {
    const closeMenu = () => setIsOpen(false);
    return (
      <MenuTooltip title={label}>
        <Popover
          content={<ShortcutsContent onAction={closeMenu} />}
          placement="bottomLeft"
          trigger="click"
          arrow={false}
          open={isOpen}
          onOpenChange={setIsOpen}
        >
          <div className={buttonClass}>
            {icon}
          </div>
        </Popover>
      </MenuTooltip>
    );
  }
  
  // For popover items
  const ContentComponent = POPOVER_COMPONENTS[itemId];
  if (!ContentComponent) return null;
  
  return (
    <MenuTooltip title={label}>
      <Popover
        content={<ContentComponent />}
        placement="bottomLeft"
        trigger="click"
        arrow={false}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <div className={buttonClass}>
          {icon}
        </div>
      </Popover>
    </MenuTooltip>
  );
};
