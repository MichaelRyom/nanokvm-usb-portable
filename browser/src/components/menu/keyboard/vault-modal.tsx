import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button, Checkbox, Input, Modal, Select, Popconfirm } from 'antd';
import {
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  LockIcon,
  SendIcon,
  SettingsIcon,
  ShieldIcon,
  CheckIcon,
  XIcon,
  DownloadIcon,
  UploadIcon,
  StarIcon,
  SearchIcon,
  CopyIcon,
  TagIcon,
} from 'lucide-react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';

import { vaultUnlockedAtom } from '@/jotai/vault';
import { typeText, pressKey } from '@/libs/keyboard/type-text';
import { generateTOTP, getTOTPTimeRemaining, parseOTPAuthURI } from '@/libs/crypto';
import * as vault from '@/libs/credential-vault';
import type { Credential } from '@/libs/credential-vault';

// --- TOTP display component ---

function TOTPDisplay({
  secret,
  period = 30,
  digits = 6,
  hidden = true,
  codeRef,
}: {
  secret: string;
  period?: number;
  digits?: number;
  hidden?: boolean;
  codeRef?: React.MutableRefObject<string>;
}) {
  const [code, setCode] = useState('------');
  const [remaining, setRemaining] = useState(period);
  const [manualReveal, setManualReveal] = useState(false);

  // Reset manual reveal when the global setting changes
  useEffect(() => {
    setManualReveal(false);
  }, [hidden]);

  const isHidden = hidden && !manualReveal;

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const c = await generateTOTP(secret, period, digits);
        if (mounted) {
          setCode(c);
          if (codeRef) codeRef.current = c;
        }
      } catch {
        if (mounted) {
          setCode('ERROR');
          if (codeRef) codeRef.current = 'ERROR';
        }
      }
      if (mounted) setRemaining(getTOTPTimeRemaining(period));
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => { mounted = false; clearInterval(timer); };
  }, [secret, period, digits, codeRef]);

  const displayCode = isHidden ? '••••••' : code;

  return (
    <div className="flex items-center gap-2">
      <code className="inline-block whitespace-nowrap rounded bg-neutral-800 px-2 py-0.5 text-center font-mono text-sm tracking-widest text-green-400" style={{ fontVariantNumeric: 'tabular-nums', minWidth: '5.5em' }}>
        {displayCode}
      </code>
      <span className="inline-block w-[24px] text-right text-xs text-neutral-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {remaining}s
      </span>
      <button
        type="button"
        onClick={() => setManualReveal(!manualReveal)}
        className="text-neutral-400 hover:text-neutral-200"
      >
        {isHidden ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
      </button>
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
  tags: string[];
  allLoginFields: { username: boolean; password: boolean; totp: boolean };
}

function CredentialForm({
  initial,
  onSave,
  onCancel,
  allTags = [],
}: {
  initial?: Credential;
  onSave: (data: CredentialFormData) => void;
  onCancel: () => void;
  allTags?: string[];
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CredentialFormData>({
    name: initial?.name ?? '',
    username: initial?.username ?? '',
    password: initial?.password ?? '',
    totpSecret: initial?.totpSecret ?? '',
    notes: initial?.notes ?? '',
    tags: initial?.tags ?? [],
    allLoginFields: {
      username: initial?.allLoginFields?.username ?? true,
      password: initial?.allLoginFields?.password ?? true,
      totp: initial?.allLoginFields?.totp ?? true,
    },
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
      <Select
        mode="tags"
        placeholder={t('keyboard.vault.tagsPlaceholder', 'Tags (type and press Enter)')}
        value={form.tags}
        onChange={(tags) => setForm((f) => ({ ...f, tags }))}
        tokenSeparators={[',']}
        style={{ width: '100%' }}
        options={allTags.map((tag) => ({ label: tag, value: tag }))}
      />
      {/* All + Login field selection */}
      {(form.username || form.password || form.totpSecret) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-neutral-600/50 bg-neutral-800/30 px-2 py-1.5">
          <span className="text-xs text-neutral-400">
            {t('keyboard.vault.allLoginIncludes', 'All + Login includes:')}
          </span>
          {form.username && (
            <Checkbox
              checked={form.allLoginFields.username}
              onChange={(e) => setForm((f) => ({ ...f, allLoginFields: { ...f.allLoginFields, username: e.target.checked } }))}
            >
              <span className="text-xs text-neutral-300">{t('keyboard.vault.username', 'Username')}</span>
            </Checkbox>
          )}
          {form.password && (
            <Checkbox
              checked={form.allLoginFields.password}
              onChange={(e) => setForm((f) => ({ ...f, allLoginFields: { ...f.allLoginFields, password: e.target.checked } }))}
            >
              <span className="text-xs text-neutral-300">{t('keyboard.vault.password', 'Password')}</span>
            </Checkbox>
          )}
          {form.totpSecret && (
            <Checkbox
              checked={form.allLoginFields.totp}
              onChange={(e) => setForm((f) => ({ ...f, allLoginFields: { ...f.allLoginFields, totp: e.target.checked } }))}
            >
              <span className="text-xs text-neutral-300">TOTP</span>
            </Checkbox>
          )}
        </div>
      )}
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
  onToggleFavorite,
  onTagClick,
  hideTOTP,
  onRequestClose,
}: {
  credential: Credential;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onTagClick: (tag: string) => void;
  hideTOTP: boolean;
  onRequestClose?: () => void;
}) {
  const { t } = useTranslation();
  const [isSending, setIsSending] = useState(false);
  const totpCodeRef = useRef('------');

  const handleTypeUsername = async (e?: React.MouseEvent) => {
    if (isSending) return;
    setIsSending(true);
    try {
      await typeText(credential.username);
      if (e?.ctrlKey) await pressKey('Enter');
    } finally {
      setIsSending(false);
      onRequestClose?.();
    }
  };

  const handleTypePassword = async (e?: React.MouseEvent) => {
    if (isSending) return;
    setIsSending(true);
    try {
      await typeText(credential.password);
      if (e?.ctrlKey) await pressKey('Enter');
    } finally {
      setIsSending(false);
      onRequestClose?.();
    }
  };

  const handleTypeTOTP = async (e?: React.MouseEvent) => {
    const code = totpCodeRef.current;
    if (isSending || !code || code === 'ERROR' || code === '------') return;
    setIsSending(true);
    try {
      await typeText(code);
      if (e?.ctrlKey) await pressKey('Enter');
    } finally {
      setIsSending(false);
      onRequestClose?.();
    }
  };

  const handleTypeAll = async () => {
    if (isSending) return;
    setIsSending(true);
    const fields = credential.allLoginFields;
    const includeUser = credential.username && (fields?.username ?? true);
    const includePass = credential.password && (fields?.password ?? true);
    const includeTotp = credential.totpSecret && (fields?.totp ?? true);
    try {
      if (includeUser) {
        await typeText(credential.username);
        if (includePass || includeTotp) {
          await pressKey('Tab');
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      if (includePass) {
        await typeText(credential.password);
      }
      if (includeTotp) {
        if (includeUser || includePass) {
          await pressKey('Tab');
          await new Promise((r) => setTimeout(r, 100));
        }
        const code = await generateTOTP(
          credential.totpSecret!,
          credential.totpPeriod ?? 30,
          credential.totpDigits ?? 6
        );
        await typeText(code);
      }
      await pressKey('Enter');
    } finally {
      setIsSending(false);
      onRequestClose?.();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // Determine which is the last row to place All+Login on that line
  const hasTotp = !!credential.totpSecret;
  const hasPassword = !!credential.password;
  const hasUsername = !!credential.username;
  const allLoginBtn = (
    <Button size="small" type="primary" onClick={handleTypeAll} disabled={isSending} className="ml-auto">
      <SendIcon size={12} className="mr-1" />
      {t('keyboard.vault.typeAll', 'All + Login')}
    </Button>
  );
  const lastRow = hasTotp ? 'totp' : hasPassword ? 'password' : hasUsername ? 'username' : 'header';

  return (
    <div className="rounded border border-neutral-700 bg-neutral-800/30 p-2">
      {/* Header: name, favorite, edit, delete */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button type="button" onClick={onToggleFavorite} className="text-neutral-400 hover:text-yellow-400">
            <StarIcon size={14} className={credential.favorite ? 'fill-yellow-400 text-yellow-400' : ''} />
          </button>
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

      {/* Tags */}
      {credential.tags && credential.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {credential.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              className="inline-flex items-center gap-0.5 rounded bg-neutral-700/60 px-1.5 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-600/60"
            >
              <TagIcon size={9} />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Username row */}
      {hasUsername && (
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block w-48 shrink-0 truncate text-xs text-neutral-400" title={credential.username}>{credential.username}</span>
          <button type="button" onClick={() => copyToClipboard(credential.username)} className="text-neutral-400 hover:text-neutral-200" title="Copy">
            <CopyIcon size={12} />
          </button>
          <Button size="small" onClick={(e) => handleTypeUsername(e)} disabled={isSending}>
            {t('keyboard.vault.typeUser', 'Type')}
          </Button>
          {lastRow === 'username' && allLoginBtn}
        </div>
      )}

      {/* Password row */}
      {hasPassword && (
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block w-48 shrink-0 text-xs text-neutral-400">••••••••</span>
          <button type="button" onClick={() => copyToClipboard(credential.password)} className="text-neutral-400 hover:text-neutral-200" title="Copy">
            <CopyIcon size={12} />
          </button>
          <Button size="small" onClick={(e) => handleTypePassword(e)} disabled={isSending}>
            {t('keyboard.vault.typePass', 'Type')}
          </Button>
          {lastRow === 'password' && allLoginBtn}
        </div>
      )}

      {/* TOTP row */}
      {hasTotp && (
        <div className="mt-1 flex items-center gap-2">
          <div className="w-48 shrink-0">
            <TOTPDisplay
              secret={credential.totpSecret!}
              period={credential.totpPeriod}
              digits={credential.totpDigits}
              hidden={hideTOTP}
              codeRef={totpCodeRef}
            />
          </div>
          <button type="button" onClick={() => copyToClipboard(totpCodeRef.current)} className="text-neutral-400 hover:text-neutral-200" title="Copy">
            <CopyIcon size={12} />
          </button>
          <Button size="small" onClick={(e) => handleTypeTOTP(e)} disabled={isSending}>
            {t('keyboard.vault.typeTotp', 'Type')}
          </Button>
          {lastRow === 'totp' && allLoginBtn}
        </div>
      )}

      {/* Fallback if only name exists */}
      {lastRow === 'header' && (
        <div className="mt-1 flex justify-end">
          {allLoginBtn}
        </div>
      )}
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
  const [hideTOTP, setHideTOTP] = useState(vault.getHideTOTP());
  const [closeAfterType, setCloseAfterType] = useState(vault.getCloseAfterType());
  const [searchQuery, setSearchQuery] = useState('');
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

  // Collect all unique tags across credentials, sorted alphabetically
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const cred of credentials) {
      if (cred.tags) cred.tags.forEach((t) => tagSet.add(t));
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [credentials]);

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
      allLoginFields: data.allLoginFields,
      notes: data.notes || undefined,
      tags: data.tags.length > 0 ? data.tags : undefined,
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
      allLoginFields: data.allLoginFields,
      notes: data.notes || undefined,
      tags: data.tags.length > 0 ? data.tags : undefined,
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

  const handleHideTOTPChange = (value: boolean) => {
    vault.setHideTOTP(value);
    setHideTOTP(value);
  };

  const handleCloseAfterTypeChange = (value: boolean) => {
    vault.setCloseAfterType(value);
    setCloseAfterType(value);
  };

  const handleToggleFavorite = async (id: string) => {
    await vault.toggleFavorite(id);
    refreshCredentials();
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-300">
              {t('keyboard.vault.hideTOTP', 'Hide all TOTP codes')}
            </span>
            <Checkbox
              checked={hideTOTP}
              onChange={(e) => handleHideTOTPChange(e.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-300">
              {t('keyboard.vault.closeAfterType', 'Close vault after typing')}
            </span>
            <Checkbox
              checked={closeAfterType}
              onChange={(e) => handleCloseAfterTypeChange(e.target.checked)}
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

      {/* Search */}
      {credentials.length > 0 && (
        <div className="mb-2 space-y-1">
          <Input
            placeholder={t('keyboard.vault.search', 'Search credentials...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefix={<SearchIcon size={14} className="text-neutral-400" />}
            allowClear
            size="small"
          />
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSearchQuery(searchQuery === tag ? '' : tag)}
                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] ${
                    searchQuery === tag
                      ? 'bg-blue-600/40 text-blue-300'
                      : 'bg-neutral-700/60 text-neutral-300 hover:bg-neutral-600/60'
                  }`}
                >
                  <TagIcon size={9} />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Credential list */}
      <div className="space-y-2">
        {credentials
          .filter((cred) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
              cred.name.toLowerCase().includes(q) ||
              cred.username.toLowerCase().includes(q) ||
              (cred.notes?.toLowerCase().includes(q) ?? false) ||
              (cred.tags?.some((tag) => tag.toLowerCase().includes(q)) ?? false)
            );
          })
          .map((cred) =>
          editingId === cred.id ? (
            <CredentialForm
              key={cred.id}
              initial={cred}
              onSave={(data) => handleEdit(cred.id, data)}
              onCancel={() => setEditingId(null)}
              allTags={allTags}
            />
          ) : (
            <CredentialItem
              key={cred.id}
              credential={cred}
              onEdit={() => { setEditingId(cred.id); setShowAddForm(false); }}
              onDelete={() => handleDelete(cred.id)}
              onToggleFavorite={() => handleToggleFavorite(cred.id)}
              onTagClick={(tag) => setSearchQuery(tag)}
              hideTOTP={hideTOTP}
              onRequestClose={closeAfterType ? handleClose : undefined}
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
            allTags={allTags}
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
