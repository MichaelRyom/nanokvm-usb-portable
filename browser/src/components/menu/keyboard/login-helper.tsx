import { useState } from 'react';
import { Button, Input, Modal } from 'antd';
import { KeyRoundIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { typeText, pressKey } from '@/libs/keyboard/type-text';

interface LoginHelperProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export const LoginHelper = ({ externalOpen, onExternalClose }: LoginHelperProps = {}) => {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Use external control if provided, otherwise internal
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSendUsername = async () => {
    if (!username || isSending) return;
    setIsSending(true);
    try {
      await typeText(username);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendPassword = async () => {
    if (!password || isSending) return;
    setIsSending(true);
    try {
      await typeText(password);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendTab = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await pressKey('Tab');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendEnter = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await pressKey('Enter');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendAll = async () => {
    if ((!username && !password) || isSending) return;
    setIsSending(true);
    try {
      if (username) {
        await typeText(username);
        await pressKey('Tab');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (password) {
        await typeText(password);
        await pressKey('Enter');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (externalOpen !== undefined && onExternalClose) {
      onExternalClose();
    } else {
      setInternalOpen(false);
    }
    setUsername('');
    setPassword('');
    setShowPassword(false);
  };

  // If externally controlled, don't render the button
  if (externalOpen !== undefined) {
    return (
      <Modal
        title={t('keyboard.loginHelper.title', 'Login Helper')}
        open={isOpen}
        onCancel={handleClose}
        footer={null}
        width={400}
      >
        <p className="mb-4 text-sm text-neutral-400">
          {t(
            'keyboard.loginHelper.description',
            'Use your password manager to auto-fill these fields, then send to the remote system.'
          )}
        </p>

        <div className="space-y-4">
          {/* Username field */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">
              {t('keyboard.loginHelper.username', 'Username')}
            </label>
            <div className="flex space-x-2">
              <Input
                type="text"
                name="username"
                autoComplete="username"
                placeholder={t('keyboard.loginHelper.usernamePlaceholder', 'Enter username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSendUsername} disabled={!username || isSending}>
                {t('keyboard.loginHelper.send', 'Send')}
              </Button>
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">
              {t('keyboard.loginHelper.password', 'Password')}
            </label>
            <div className="flex space-x-2">
              <Input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder={t('keyboard.loginHelper.passwordPlaceholder', 'Enter password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1"
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                }
              />
              <Button onClick={handleSendPassword} disabled={!password || isSending}>
                {t('keyboard.loginHelper.send', 'Send')}
              </Button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-between pt-2">
            <div className="space-x-2">
              <Button size="small" onClick={handleSendTab} disabled={isSending}>
                Tab ↹
              </Button>
              <Button size="small" onClick={handleSendEnter} disabled={isSending}>
                Enter ↵
              </Button>
            </div>
            <Button
              type="primary"
              onClick={handleSendAll}
              disabled={(!username && !password) || isSending}
            >
              {t('keyboard.loginHelper.sendAll', 'Send All + Login')}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <div
        className="flex h-[32px] cursor-pointer items-center space-x-2 rounded px-3 text-neutral-300 hover:bg-neutral-700/50"
        onClick={() => setInternalOpen(true)}
      >
        <KeyRoundIcon size={16} />
        <span>{t('keyboard.loginHelper.title', 'Login Helper')}</span>
      </div>

      <Modal
        title={t('keyboard.loginHelper.title', 'Login Helper')}
        open={isOpen}
        onCancel={handleClose}
        footer={null}
        width={400}
      >
        <p className="mb-4 text-sm text-neutral-400">
          {t(
            'keyboard.loginHelper.description',
            'Use your password manager to auto-fill these fields, then send to the remote system.'
          )}
        </p>

        <div className="space-y-4">
          {/* Username field */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">
              {t('keyboard.loginHelper.username', 'Username')}
            </label>
            <div className="flex space-x-2">
              <Input
                type="text"
                name="username"
                autoComplete="username"
                placeholder={t('keyboard.loginHelper.usernamePlaceholder', 'Enter username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSendUsername} disabled={!username || isSending}>
                {t('keyboard.loginHelper.send', 'Send')}
              </Button>
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">
              {t('keyboard.loginHelper.password', 'Password')}
            </label>
            <div className="flex space-x-2">
              <Input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder={t('keyboard.loginHelper.passwordPlaceholder', 'Enter password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1"
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                }
              />
              <Button onClick={handleSendPassword} disabled={!password || isSending}>
                {t('keyboard.loginHelper.send', 'Send')}
              </Button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-between pt-2">
            <div className="space-x-2">
              <Button size="small" onClick={handleSendTab} disabled={isSending}>
                Tab ↹
              </Button>
              <Button size="small" onClick={handleSendEnter} disabled={isSending}>
                Enter ↵
              </Button>
            </div>
            <Button
              type="primary"
              onClick={handleSendAll}
              disabled={(!username && !password) || isSending}
            >
              {t('keyboard.loginHelper.sendAll', 'Send All + Login')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
