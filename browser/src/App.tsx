import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { Alert, Result, Spin } from 'antd';
import clsx from 'clsx';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from 'react-responsive';

import { DeviceModal } from '@/components/device-modal';
import { Keyboard } from '@/components/keyboard';
import { Menu } from '@/components/menu';
import { Mouse } from '@/components/mouse';
import { PasteDialog, pasteStateAtom } from '@/components/paste-dialog';
import { VirtualKeyboard } from '@/components/virtual-keyboard';
import {
  resolutionAtom,
  serialStateAtom,
  videoRotationAtom,
  videoScaleAtom,
  videoStateAtom
} from '@/jotai/device.ts';
import { isKeyboardEnableAtom, targetKeyboardLayoutAtom } from '@/jotai/keyboard.ts';
import { mouseStyleAtom } from '@/jotai/mouse.ts';
import { device } from '@/libs/device';
import { camera } from '@/libs/media/camera';
import { checkPermission, requestCameraPermission } from '@/libs/media/permission.ts';
import * as storage from '@/libs/storage';
import type { Resolution } from '@/types.ts';

const App = () => {
  const { t } = useTranslation();
  const isBigScreen = useMediaQuery({ minWidth: 850 });

  const mouseStyle = useAtomValue(mouseStyleAtom);
  const videoScale = useAtomValue(videoScaleAtom);
  const videoState = useAtomValue(videoStateAtom);
  const serialState = useAtomValue(serialStateAtom);
  const isKeyboardEnable = useAtomValue(isKeyboardEnableAtom);
  const targetLayout = useAtomValue(targetKeyboardLayoutAtom);
  const setPasteState = useSetAtom(pasteStateAtom);
  const setResolution = useSetAtom(resolutionAtom);
  const [videoRotation, setVideoRotation] = useAtom(videoRotationAtom);

  const [isLoading, setIsLoading] = useState(true);
  const [isCameraGranted, setIsCameraGranted] = useState(false);
  const [shouldSwapDimensions, setShouldSwapDimensions] = useState(false);

  useEffect(() => {
    initResolution();
    initRotation();

    return () => {
      camera.close();
      device.serialPort.close();
    };
  }, []);

  useEffect(() => {
    setShouldSwapDimensions(videoRotation === 90 || videoRotation === 270);
  }, [videoRotation]);

  // Global Ctrl+V handler - intercept paste when serial is connected
  useEffect(() => {
    if (serialState !== 'connected') return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Debug: log all key events with modifiers
      if (e.ctrlKey || e.shiftKey || e.altKey) {
        console.log('Key event:', { key: e.key, code: e.code, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey });
      }
      
      // Check for Ctrl+Shift+Insert to paste to target (avoids browser's built-in Ctrl+Shift+V)
      const isPasteShortcut = e.ctrlKey && e.shiftKey && e.code === 'Insert';
      
      if (isPasteShortcut) {
        console.log('Ctrl+Shift+Insert detected, reading clipboard...');
        const target = e.target as HTMLElement;
        // Don't intercept in input fields
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        try {
          const text = await navigator.clipboard.readText();
          console.log('Clipboard text:', text ? `${text.length} chars` : 'empty');
          if (text) {
            // Show paste confirmation dialog
            setPasteState({
              isOpen: true,
              text,
              layoutId: targetLayout,
              isPasting: false,
              progress: 0,
              currentChar: 0,
              totalChars: text.length
            });
          }
        } catch (err) {
          console.error('Failed to read clipboard:', err);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [serialState, targetLayout]);

  const videoStyle = useMemo(() => {
    const baseStyle = {
      transformOrigin: 'center',
      maxWidth: shouldSwapDimensions ? '100vh' : '100%',
      maxHeight: shouldSwapDimensions ? '100vw' : '100%'
    };

    if (videoScale === 0) {
      return {
        ...baseStyle,
        width: shouldSwapDimensions ? '100vh' : '100%',
        height: shouldSwapDimensions ? '100vw' : '100%',
        objectFit: 'contain',
        transform: `rotate(${videoRotation}deg)`
      };
    }

    return {
      ...baseStyle,
      objectFit: 'scale-down',
      transform: `scale(${videoScale}) rotate(${videoRotation}deg)`
    };
  }, [videoScale, videoRotation, shouldSwapDimensions]);

  function initResolution() {
    const resolution = storage.getVideoResolution();
    if (resolution) {
      setResolution(resolution);
    }

    requestPermission(resolution);
  }

  function initRotation() {
    const rotation = storage.getVideoRotation();
    if (rotation) {
      setVideoRotation(rotation);
    }
  }

  async function requestPermission(resolution?: Resolution) {
    try {
      const isGranted = await checkPermission('camera');
      if (isGranted) {
        setIsCameraGranted(true);
        return;
      }

      const isSuccess = await requestCameraPermission(resolution);
      setIsCameraGranted(isSuccess);
    } catch (err: any) {
      console.log('failed to request media permissions: ', err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <Spin size="large" spinning={isLoading} tip={t('camera.tip')} fullscreen />;
  }

  if (!isCameraGranted) {
    return (
      <Result
        status="info"
        title={t('camera.denied')}
        extra={[<h2 className="text-xl text-white">{t('camera.authorize')}</h2>]}
      />
    );
  }

  return (
    <>
      <DeviceModal />
      <PasteDialog />

      {videoState === 'connected' && (
        <>
          <Menu />

          {serialState === 'notSupported' && (
            <Alert message={t('serial.notSupported')} type="warning" banner closable />
          )}

          {serialState === 'connected' && (
            <>
              <Mouse />
              {isKeyboardEnable && <Keyboard />}
            </>
          )}
        </>
      )}

      <video
        id="video"
        className={clsx(
          'block select-none',
          shouldSwapDimensions ? 'min-h-[640px] min-w-[360px]' : 'min-h-[360px] min-w-[640px]',
          mouseStyle
        )}
        style={videoStyle as CSSProperties}
        autoPlay
        playsInline
      />

      <VirtualKeyboard isBigScreen={isBigScreen} />
    </>
  );
};

export default App;
