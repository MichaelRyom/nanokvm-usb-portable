import { useEffect } from 'react';
import { Button } from 'antd';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';

import { serialStateAtom } from '@/jotai/device.ts';
import { device } from '@/libs/device';

type SerialPortProps = {
  setErrMsg: (msg: string) => void;
};

export const SerialPort = ({ setErrMsg }: SerialPortProps) => {
  const { t } = useTranslation();

  const [serialState, setSerialState] = useAtom(serialStateAtom);

  useEffect(() => {
    checkSerialPort();
  }, []);

  function checkSerialPort() {
    const isWebSerialSupported = 'serial' in navigator;
    const state = isWebSerialSupported ? 'disconnected' : 'notSupported';
    setSerialState(state);
  }

  async function selectSerialPort() {
    if (serialState === 'connecting') return;
    setSerialState('connecting');
    setErrMsg('');

    try {
      const port = await navigator.serial.requestPort();
      await device.serialPort.init(port);

      setSerialState('connected');
    } catch (err) {
      console.log(err);
      setSerialState('disconnected');
      setErrMsg(t('serial.failed'));
    }
  }

  return (
    <>
      {serialState !== 'notSupported' && (
        <Button
          type="primary"
          className="w-[250px]"
          loading={serialState === 'connecting'}
          onClick={selectSerialPort}
        >
          {t('modal.selectSerial')}
        </Button>
      )}
    </>
  );
};
