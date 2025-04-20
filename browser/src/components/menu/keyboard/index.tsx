import { useState } from 'react';
import { Popover } from 'antd';
import { KeyboardIcon } from 'lucide-react';

import { Paste } from './paste.tsx';
import { VirtualKeyboard } from './virtual-keyboard.tsx';
import { CtrlAltDel } from './ctrl-alt-del';

export const Keyboard = () => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const content = (
    <>
      <Paste />
      <CtrlAltDel />
      <VirtualKeyboard />
    </>
  );

  return (
    <Popover
      content={content}
      placement="bottomLeft"
      trigger="click"
      arrow={false}
      open={isPopoverOpen}
      onOpenChange={setIsPopoverOpen}
    >
      <div className="flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded text-white hover:bg-neutral-700/70">
        <KeyboardIcon size={18} />
      </div>
    </Popover>
  );
};
