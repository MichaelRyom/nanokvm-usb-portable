import { ReactElement, useEffect, useState } from 'react'
import { Popover } from 'antd'
import clsx from 'clsx'
import { useAtom, useAtomValue } from 'jotai'
import { VideoIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { resolutionAtom, videoDeviceIdAtom } from '@renderer/jotai/device'
import { camera } from '@renderer/libs/camera'
import * as storage from '@renderer/libs/storage'

export const Device = (): ReactElement => {
  const { t } = useTranslation()
  const resolution = useAtomValue(resolutionAtom)
  const [videoDeviceId, setVideoDeviceId] = useAtom(videoDeviceIdAtom)

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        // Prompt for camera access to unlock device labels
        await navigator.mediaDevices.getUserMedia({ video: true })
      } catch (err) {
        console.error('Camera permission denied:', err)
        return
      }

      const deviceInfo = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = deviceInfo.filter((device) => device.kind === 'videoinput')
      setDevices(videoDevices)
    })()
  }, [])

  async function selectDevice(deviceId: string): Promise<void> {
    if (isLoading) return
    setIsLoading(true)

    try {
      const success = await camera.open(deviceId, resolution.width, resolution.height)
      if (!success) return

      const video = document.getElementById('video') as HTMLVideoElement
      if (!video) return
      video.srcObject = camera.getStream()

      // Start playback explicitly
      try {
        await video.play()
      } catch (err) {
        console.error('video.play() failed:', err)
      }

      setVideoDeviceId(deviceId)
      storage.setVideoDevice(deviceId)
    } finally {
      setIsLoading(false)
    }
  }

  const content = (
    <div className="max-h-[350px] overflow-y-auto">
      {devices.map((device: MediaDeviceInfo) => (
        <div
          key={device.deviceId}
          className={clsx(
            'cursor-pointer rounded px-2 py-1.5 hover:bg-neutral-700/60',
            device.deviceId === videoDeviceId ? 'text-blue-500' : 'text-white'
          )}
          onClick={() => selectDevice(device.deviceId)}
        >
          {device.label}
        </div>
      ))}
    </div>
  )

  return (
    <Popover content={content} placement="rightTop">
      <div className="flex h-[30px] cursor-pointer items-center space-x-2 rounded px-3 text-neutral-300 hover:bg-neutral-700">
        <VideoIcon size={18} />
        <span className="text-sm select-none">{t('video.device')}</span>
      </div>
    </Popover>
  )
}
