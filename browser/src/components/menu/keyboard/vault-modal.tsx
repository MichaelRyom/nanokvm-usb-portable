import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Modal, Select, Popconfirm } from 'antd';
import {
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  LockIcon,
  SendIcon,
  KeyRoundIcon,
  SettingsIcon,
  ShieldIcon,
  CheckIcon,
  XIcon,
  DownloadIcon,
  UploadIcon,
} from 'lucide-react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';

import { vaultUnlockedAtom } from '@/jotai/vault';
import { typeText, pressKey } from '@/libs/keyboard/type-text';
import { generateTOTP, getTOTPTimeRemaining, parseOTPAuthURI } from '@/libs/crypto';
import * as vault from '@/libs/credential-vault';
import type { Credential } from '@/libs/credential-vault';

// --- TOTP display component ---

function TOTPDisplay({ secret, period = 30, digits = 6 }: { secret: string; period?: number; digits?: number }) {
  const [code, setCode] = useState('------');
  const [remaining, setRemaining] = useState(period);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const c = await generateTOTP(secret, period, digits);
        if (mounted) setCode(c);
      } catch {
        if (mounted) setCode('ERROR');
      }
      if (mounted) setRemaining(getTOTPTimeRemaining(period));
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => { mounted = false; clearInterval(timer); };
  }, [secret, period, digits]);

  const handleType = async () => {
    if (isSending || code === 'ERROR' || code === '------') return;
    setIsSending(true);
    try {
      await typeText(code);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <code className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-sm tracking-widest text-green-400">
        {code}
      </code>
      <span className="text-xs text-neutral-500">{remaining}s</span>
      <Button size="small" onClick={handleType} disabled={isSending}>
        Type
      </Button>
    </div>
  );
}

// --- Credential form ---

interface CredentialFormData {
  name: string;
  username: string;
  password: string;
  totpSecret: string;
  notes: string;
}

function CredentialForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Credential;
  onSave: (data: CredentialFormData) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CredentialFormData>({
    name: initial?.name ?? '',
    username: initial?.username ?? '',
    password: initial?.password ?? '',
    totpSecret: initial?.totpSecret ?? '',
    notes: initial?.notes ?? '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleTotpChange = (value: string) => {
    // If user pastes an otpauth:// URI, extract the secret
    const parsed = parseOTPAuthURI(value);
    if (parsed) {
      setForm((f) => ({ ...f, totpSecret: parsed.secret }));
    } else {
      setForm((f) => ({ ...f, totpSecret: value }));
    }
  };

  return (
    <div className="space-y-3 rounded border border-neutral-700 bg-neutral-800/50 p-3">
      <Input
        placeholder={t('keyboard.vault.namePlaceholder', 'Entry name (e.g. Windows Login)')}
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
      <Input
        placeholder={t('keyboard.vault.username', 'Username')}
        value={form.username}
        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
      />
      <Input
        type={showPassword ? 'text' : 'password'}
        placeholder={t('keyboard.vault.password', 'Password')}
        value={form.password}
        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        suffix={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-neutral-400 hover:text-neutral-200"
          >
            {showPassword ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
          </button>
        }
      />
      <Input
        placeholder={t('keyboard.vault.totpPlaceholder', 'TOTP secret or otpauth:// URI (optional)')}
        value={form.totpSecret}
        onChange={(e) => handleTotpChange(e.target.value)}
      />
      <Input.TextArea
        placeholder={t('keyboard.vault.notes', 'Notes (optional)')}
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        rows={2}
      />
      <div className="flex justify-end space-x-2">
        <Button size="small" onClick={onCancel} icon={<XIcon size={14} />}>
          {t('keyboard.vault.cancel', 'Cancel')}
        </Button>
        <Button
          size="small"
          type="primary"
          onClick={() => onSave(form)}
          disabled={!form.name}
          icon={<CheckIcon size={14} />}
        >
          {t('keyboard.vault.save', 'Save')}
        </Button>
      </div>
    </div>
  );
}

// --- Credential list item ---

function CredentialItem({
  credential,
  onEdit,
  onDelete,
}: {
  credential: Credential;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [isSending, setIsSending] = useState(false);

  const handleTypeUsername = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await typeText(credential.username);
    } finally {
      setIsSending(false);
    }
  };

  const handleTypePassword = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await typeText(credential.password);
    } finally {
      setIsSending(false);
    }
  };

  const handleTypeAll = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      if (credential.username) {
        await typeText(credential.username);
        await pressKey('Tab');
        await new Promise((r) => setTimeout(r, 100));
      }
      if (credential.password) {
        await typeText(credential.password);
      }
      // If TOTP is configured, type it after a tab
      if (credential.totpSecret) {
        await pressKey('Tab');
        await new Promise((r) => setTimeout(r, 100));
        const code = await generateTOTP(
          credential.totpSecret,
          credential.totpPeriod ?? 30,
          credential.totpDigits ?? 6
        );
        await typeText(code);
      }
      await pressKey('Enter');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded border border-neutral-700 bg-neutral-800/30 p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <KeyRoundIcon size={14} className="text-neutral-400" />
          <span className="text-sm font-medium text-neutral-200">{credential.name}</span>
        </div>
        <div className="flex items-center space-x-1">
          <Button size="small" type="text" onClick={onEdit} icon={<PencilIcon size={14} />} />
          <Popconfirm
            title={t('keyboard.vault.deleteConfirm', 'Delete this credential?')}
            onConfirm={onDelete}
            okText={t('keyboard.vault.yes', 'Yes')}
            cancelText={t('keyboard.vault.no', 'No')}
          >
            <Button size="small" type="text" danger icon={<Trash2Icon size={14} />} />
          </Popconfirm>
        </div>
      </div>

      {credential.username && (
        <div className="mt-1 text-xs text-neutral-400">{credential.username}</div>
      )}

      {credential.totpSecret && (
        <div className="mt-2">
          <TOTPDisplay
            secret={credential.totpSecret}
            period={credential.totpPeriod}
            digits={credential.totpDigits}
          />
        </div>
      )}

      <div className="mt-2 flex space-x-1">
        <Button size="small" onClick={handleTypeUsername} disabled={!credential.username || isSending}>
          {t('keyboard.vault.typeUser', 'Type User')}
        </Button>
        <Button size="small" onClick={handleTypePassword} disabled={!credential.password || isSending}>
          {t('keyboard.vault.typePass', 'Type Pass')}
        </Button>
        <Button size="small" type="primary" onClick={handleTypeAll} disabled={isSending}>
          <SendIcon size={12} className="mr-1" />
          {t('keyboard.vault.typeAll', 'All + Login')}
        </Button>
      </div>
    </div>
  );
}

// --- Main vault modal ---

interface VaultModalProps {
  open: boolean;
  onClose: () => void;
}

export const VaultModal = ({ open, onClose }: VaultModalProps) => {
  const { t } = useTranslation();
  const [unlocked, setUnlocked] = useAtom(vaultUnlockedAtom);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState(vault.getAutoLockMinutes());
  const [showSettings, setShowSettings] = useState(false);
  const [changePwMode, setChangePwMode] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [importMode, setImportMode] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [importFileData, setImportFileData] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoLockTimerRef = useRef<ReturnType<typeof setInterval>>();

  const initialized = vault.isInitialized();

  const refreshCredentials = useCallback(() => {
    if (vault.isUnlocked()) {
      setCredentials(vault.getCredentials());
      setUnlocked(true);
    } else {
      setCredentials([]);
      setUnlocked(false);
    }
  }, [setUnlocked]);

  // Check auto-lock periodically
  useEffect(() => {
    if (!open || !unlocked) return;
    autoLockTimerRef.current = setInterval(() => {
      if (!vault.isUnlocked()) {
        setUnlocked(false);
        setCredentials([]);
      }
    }, 5000);
    return () => clearInterval(autoLockTimerRef.current);
  }, [open, unlocked, setUnlocked]);

  // Refresh credentials when modal opens
  useEffect(() => {
    if (open) refreshCredentials();
  }, [open, refreshCredentials]);

  const handleInitialize = async () => {
    if (!masterPassword || masterPassword !== confirmPassword) {
      setError(t('keyboard.vault.passwordMismatch', 'Passwords do not match'));
      return;
    }
    if (masterPassword.length < 4) {
      setError(t('keyboard.vault.passwordTooShort', 'Password must be at least 4 characters'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await vault.initialize(masterPassword);
      setUnlocked(true);
      setMasterPassword('');
      setConfirmPassword('');
      refreshCredentials();
    } catch {
      setError(t('keyboard.vault.initError', 'Failed to initialize vault'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!masterPassword) return;
    setLoading(true);
    setError('');
    try {
      const ok = await vault.unlock(masterPassword);
      if (ok) {
        setUnlocked(true);
        setMasterPassword('');
        refreshCredentials();
      } else {
        setError(t('keyboard.vault.wrongPassword', 'Wrong master password'));
      }
    } catch {
      setError(t('keyboard.vault.unlockError', 'Failed to unlock vault'));
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () => {
    vault.lock();
    setUnlocked(false);
    setCredentials([]);
    setEditingId(null);
    setShowAddForm(false);
    setShowSettings(false);
    setChangePwMode(false);
  };

  const handleAdd = async (data: CredentialFormData) => {
    await vault.addCredential({
      name: data.name,
      username: data.username,
      password: data.password,
      totpSecret: data.totpSecret || undefined,
      notes: data.notes || undefined,
    });
    setShowAddForm(false);
    refreshCredentials();
  };

  const handleEdit = async (id: string, data: CredentialFormData) => {
    await vault.updateCredential(id, {
      name: data.name,
      username: data.username,
      password: data.password,
      totpSecret: data.totpSecret || undefined,
      notes: data.notes || undefined,
    });
    setEditingId(null);
    refreshCredentials();
  };

  const handleDelete = async (id: string) => {
    await vault.deleteCredential(id);
    refreshCredentials();
  };

  const handleAutoLockChange = (value: number) => {
    vault.setAutoLockMinutes(value);
    setAutoLockMinutes(value);
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) return;
    if (newPassword.length < 4) {
      setError(t('keyboard.vault.passwordTooShort', 'Password must be at least 4 characters'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ok = await vault.changeMasterPassword(oldPassword, newPassword);
      if (ok) {
        setChangePwMode(false);
        setOldPassword('');
        setNewPassword('');
        refreshCredentials();
      } else {
        setError(t('keyboard.vault.wrongPassword', 'Wrong master password'));
      }
    } catch {
      setError(t('keyboard.vault.changeError', 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const data = vault.exportVault();
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nanokvm-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImportFileData(reader.result as string);
      setImportMode(true);
    };
    reader.readAsText(file);
    // Reset file input so the same file can be re-selected
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importFileData || !importPassword) return;
    setLoading(true);
    setError('');
    try {
      const ok = await vault.importVault(importFileData, importPassword);
      if (ok) {
        setUnlocked(true);
        setImportMode(false);
        setImportPassword('');
        setImportFileData(null);
        setImportFileName('');
        refreshCredentials();
      } else {
        setError(t('keyboard.vault.importError', 'Wrong password or invalid vault file'));
      }
    } catch {
      setError(t('keyboard.vault.importError', 'Wrong password or invalid vault file'));
    } finally {
      setLoading(false);
    }
  };

  const handleImportCancel = () => {
    setImportMode(false);
    setImportPassword('');
    setImportFileData(null);
    setImportFileName('');
    setError('');
  };

  const handleClose = () => {
    setError('');
    setMasterPassword('');
    setConfirmPassword('');
    setShowAddForm(false);
    setEditingId(null);
    setShowSettings(false);
    setChangePwMode(false);
    setOldPassword('');
    setNewPassword('');
    setImportMode(false);
    setImportPassword('');
    setImportFileData(null);
    setImportFileName('');
    onClose();
  };

  // Hidden file input for import
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".json"
      className="hidden"
      onChange={handleImportFileSelect}
    />
  );

  // --- Render: Import mode (shown over any state) ---
  if (importMode) {
    return (
      <Modal
        title={t('keyboard.vault.import', 'Import Vault')}
        open={open}
        onCancel={handleImportCancel}
        footer={null}
        width={420}
      >
        {fileInput}
        <p className="mb-3 text-sm text-neutral-400">
          {t('keyboard.vault.importDesc', 'Enter the master password for the vault file to import it.')}
        </p>
        <div className="mb-3 rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-300">
          {importFileName}
        </div>
        <div className="space-y-3">
          <Input.Password
            placeholder={t('keyboard.vault.masterPassword', 'Master password')}
            value={importPassword}
            onChange={(e) => setImportPassword(e.target.value)}
            onPressEnter={handleImportConfirm}
            autoFocus
          />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex space-x-2">
            <Button block onClick={handleImportCancel}>
              {t('keyboard.vault.cancel', 'Cancel')}
            </Button>
            <Button type="primary" block loading={loading} onClick={handleImportConfirm}>
              {t('keyboard.vault.importBtn', 'Import')}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // --- Render: Not initialized ---
  if (!initialized) {
    return (
      <Modal
        title={t('keyboard.vault.setup', 'Set Up Credential Vault')}
        open={open}
        onCancel={handleClose}
        footer={null}
        width={420}
      >
        {fileInput}
        <p className="mb-4 text-sm text-neutral-400">
          {t('keyboard.vault.setupDesc', 'Create a master password to encrypt your stored credentials.')}
        </p>
        <div className="space-y-3">
          <Input.Password
            placeholder={t('keyboard.vault.masterPassword', 'Master password')}
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            onPressEnter={() => confirmPassword && handleInitialize()}
          />
          <Input.Password
            placeholder={t('keyboard.vault.confirmPassword', 'Confirm master password')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onPressEnter={handleInitialize}
          />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <Button type="primary" block loading={loading} onClick={handleInitialize}>
            {t('keyboard.vault.create', 'Create Vault')}
          </Button>
          <div className="text-center text-sm text-neutral-500">
            {t('keyboard.vault.or', 'or')}
          </div>
          <Button block icon={<UploadIcon size={14} />} onClick={() => fileInputRef.current?.click()}>
            {t('keyboard.vault.importFile', 'Import from File')}
          </Button>
        </div>
      </Modal>
    );
  }

  // --- Render: Locked ---
  if (!unlocked) {
    return (
      <Modal
        title={t('keyboard.vault.unlock', 'Unlock Vault')}
        open={open}
        onCancel={handleClose}
        footer={null}
        width={420}
      >
        <div className="space-y-3">
          <Input.Password
            placeholder={t('keyboard.vault.masterPassword', 'Master password')}
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            onPressEnter={handleUnlock}
            autoFocus
          />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <Button type="primary" block loading={loading} onClick={handleUnlock}>
            <LockIcon size={14} className="mr-1" />
            {t('keyboard.vault.unlockBtn', 'Unlock')}
          </Button>
        </div>
      </Modal>
    );
  }

  // --- Render: Unlocked ---
  return (
    <Modal
      title={
        <div className="flex items-center justify-between pr-8">
          <span>{t('keyboard.vault.title', 'Credential Vault')}</span>
          <div className="flex items-center space-x-1">
            <Button size="small" type="text" onClick={() => setShowSettings(!showSettings)}>
              <SettingsIcon size={14} />
            </Button>
            <Button size="small" type="text" onClick={handleLock}>
              <LockIcon size={14} />
            </Button>
          </div>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={480}
    >
      {/* Settings panel */}
      {showSettings && (
        <div className="mb-3 space-y-2 rounded border border-neutral-700 bg-neutral-800/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-300">
              {t('keyboard.vault.autoLock', 'Auto-lock timeout')}
            </span>
            <Select
              size="small"
              value={autoLockMinutes}
              onChange={handleAutoLockChange}
              style={{ width: 140 }}
              options={[
                { value: 0, label: t('keyboard.vault.disabled', 'Disabled') },
                { value: 1, label: '1 min' },
                { value: 2, label: '2 min' },
                { value: 5, label: '5 min' },
                { value: 10, label: '10 min' },
                { value: 15, label: '15 min' },
                { value: 30, label: '30 min' },
                { value: 60, label: '1 hour' },
                { value: 120, label: '2 hours' },
                { value: 240, label: '4 hours' },
                { value: 480, label: '8 hours' },
                { value: 720, label: '12 hours' },
                { value: 1440, label: '24 hours' },
              ]}
            />
          </div>
          {!changePwMode ? (
            <Button size="small" block onClick={() => setChangePwMode(true)}>
              {t('keyboard.vault.changePassword', 'Change Master Password')}
            </Button>
          ) : (
            <div className="space-y-2">
              <Input.Password
                size="small"
                placeholder={t('keyboard.vault.oldPassword', 'Current password')}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
              <Input.Password
                size="small"
                placeholder={t('keyboard.vault.newPassword', 'New password')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onPressEnter={handleChangePassword}
              />
              {error && <div className="text-sm text-red-400">{error}</div>}
              <div className="flex space-x-2">
                <Button size="small" onClick={() => { setChangePwMode(false); setError(''); }}>
                  {t('keyboard.vault.cancel', 'Cancel')}
                </Button>
                <Button size="small" type="primary" loading={loading} onClick={handleChangePassword}>
                  {t('keyboard.vault.save', 'Save')}
                </Button>
              </div>
            </div>
          )}
          <div className="flex space-x-2">
            <Button size="small" block icon={<DownloadIcon size={14} />} onClick={handleExport}>
              {t('keyboard.vault.export', 'Export')}
            </Button>
            <Button size="small" block icon={<UploadIcon size={14} />} onClick={() => fileInputRef.current?.click()}>
              {t('keyboard.vault.importBtn', 'Import')}
            </Button>
          </div>
        </div>
      )}

      {fileInput}

      {/* Credential list */}
      <div className="space-y-2">
        {credentials.map((cred) =>
          editingId === cred.id ? (
            <CredentialForm
              key={cred.id}
              initial={cred}
              onSave={(data) => handleEdit(cred.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <CredentialItem
              key={cred.id}
              credential={cred}
              onEdit={() => { setEditingId(cred.id); setShowAddForm(false); }}
              onDelete={() => handleDelete(cred.id)}
            />
          )
        )}

        {credentials.length === 0 && !showAddForm && (
          <div className="py-4 text-center text-sm text-neutral-500">
            <ShieldIcon size={24} className="mx-auto mb-2 opacity-50" />
            {t('keyboard.vault.empty', 'No credentials stored yet')}
          </div>
        )}

        {showAddForm ? (
          <CredentialForm
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <Button
            block
            type="dashed"
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
            icon={<PlusIcon size={14} />}
          >
            {t('keyboard.vault.add', 'Add Credential')}
          </Button>
        )}
      </div>
    </Modal>
  );
};
