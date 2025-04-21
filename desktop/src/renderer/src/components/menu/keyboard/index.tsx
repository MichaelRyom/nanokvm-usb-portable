import { ReactElement, useState } from 'react'
import { Popover } from 'antd'
import { KeyboardIcon } from 'lucide-react'

import { CtrlAltDel } from './ctrl-alt-del'
import { Paste } from './paste'
import { VirtualKeyboard } from './virtual-keyboard'

export const Keyboard = (): ReactElement => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const content = (
    <>
      <Paste />
      <CtrlAltDel />
      <VirtualKeyboard />
    </>
  )

  return (
    <Popover
      content={content}
      placement="bottomLeft"
      trigger="click"
      arrow={false}
      open={isPopoverOpen}
      onOpenChange={setIsPopoverOpen}
    >
      <div className="flex h-[28px] cursor-pointer items-center justify-center rounded px-2 text-white hover:bg-neutral-700/70">
        <KeyboardIcon size={18} />
      </div>
    </Popover>
  )
}
