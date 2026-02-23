import { useState } from 'react';
import { ShieldIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { VaultModal } from './vault-modal';

interface CredentialVaultProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export const CredentialVault = ({ externalOpen, onExternalClose }: CredentialVaultProps = {}) => {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;

  const handleClose = () => {
    if (externalOpen !== undefined && onExternalClose) {
      onExternalClose();
    } else {
      setInternalOpen(false);
    }
  };

  // If externally controlled, don't render the button
  if (externalOpen !== undefined) {
    return <VaultModal open={isOpen} onClose={handleClose} />;
  }

  return (
    <>
      <div
        className="flex h-[32px] cursor-pointer items-center space-x-2 rounded px-3 text-neutral-300 hover:bg-neutral-700/50"
        onClick={() => setInternalOpen(true)}
      >
        <ShieldIcon size={16} />
        <span>{t('keyboard.vault.title', 'Credential Vault')}</span>
      </div>

      <VaultModal open={isOpen} onClose={handleClose} />
    </>
  );
};
