import { ReactElement, useState } from 'react'
import { SendHorizonal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IpcEvents } from '@common/ipc-events'
import { KeyboardCodes } from '@renderer/libs/keyboard'

export const CtrlAltDel = (): ReactElement => {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)

  async function ctrlAltDel(): Promise<void> {
    if (isLoading) return
    setIsLoading(true)

    try {
      await send(5, KeyboardCodes.get('Delete')!) // modifier 5 is ctrlLeft + altLeft

      await send(0, 0)
    } catch (e) {
      console.log(e)
    } finally {
      setIsLoading(false)
    }
  }

  async function send(modifier: number, key: number): Promise<void> {
    await window.electron.ipcRenderer.invoke(IpcEvents.SEND_KEYBOARD, modifier, key)
  }

  return (
    <div
      className="flex h-[30px] cursor-pointer items-center space-x-1 rounded px-3 text-neutral-300 hover:bg-neutral-700/60"
      onClick={ctrlAltDel}
    >
      <SendHorizonal size={18} />
      <span>{t('keyboard.ctrlAltDel')}</span>
    </div>
  )
}
