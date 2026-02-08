import styled from 'styled-components'
import { useEffect, useMemo, useState } from 'react'

import { toast } from 'sonner'

import CBaseUserAccount from '../base/CBaseUserAccount'
import PopUpFormButton from '../foundations/PopUpFormButton'
import CustomInputField from '../foundations/CustomInputField'
import { ImportIcon } from 'lucide-react'

import { SeedKeyInput } from '../foundations/SeedKeyInput'

import { downloadBlob } from '../../utils/utils'
import { PlusIcon } from '@phosphor-icons/react'

import { SectionTitleFrame } from '../../globals/styled-components'
import {
  jsonToSeed,
  MajikContact,
  seedStringToArray,
  type MnemonicJSON
} from '@majikah/majik-message'
import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import DynamicPlaceholder from '../foundations/DynamicPlaceholder'

const Container = styled.div`
  width: inherit;
  height: 100%;
  padding: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const List = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    padding: 0;
    margin: 8px 0;
    width: inherit;
    gap: 8px;
  }
`

const MAX_ACCOUNT_LIMIT = 25

interface PassphraseUpdateParams {
  id: string
  passphrase: { old: string; new: string }
}

interface AccountsPanelProps {
  majik: MajikMessageDatabase
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void
}

// ======== Main Component ========

const AccountsPanel: React.FC<AccountsPanelProps> = ({ majik, onUpdate }) => {
  const [label, setLabel] = useState<string>('')
  const [passphrase, setPassphrase] = useState<string>('')
  const [mnemonic, setMnemonic] = useState<string>('')

  const [refreshKey, setRefreshKey] = useState<number>(0)

  const [mnemonicJSON, setMnemonicJSON] = useState<MnemonicJSON | undefined>(undefined)

  useEffect(() => {
    if (!majik) return

    const handler = (): void => {
      setRefreshKey((prev) => prev + 1)
    }

    majik.on('active-account-change', handler)
    majik.on('new-account', handler)

    // Cleanup
    return () => {
      majik.off('active-account-change', handler)
      majik.off('new-account', handler)
    }
  }, [majik])

  const handleCreate = async (): Promise<void> => {
    try {
      let accountID: string = 'Unknown'

      if (mnemonic && mnemonic.trim().length > 0) {
        if (!passphrase?.trim()) {
          toast.error('Failed to create account', {
            description: 'Password must be a non-empty string.',
            id: `toast-error-create`
          })
          return
        }

        const createdAccount = await majik.createAccountFromMnemonic(
          mnemonic.trim(),
          passphrase,
          label
        )
        accountID = createdAccount.id

        const jsonData: MnemonicJSON = {
          id: createdAccount.backup,
          seed: seedStringToArray(mnemonic.trim()),
          phrase: passphrase?.trim() ? passphrase.trim() : undefined
        }

        setMnemonicJSON(jsonData)

        const jsonString = JSON.stringify(jsonData)

        const blob = new Blob([jsonString], {
          type: 'application/json;charset=utf-8'
        })
        downloadBlob(blob, 'json', `${label} | ${createdAccount.id} | SEED KEY`)
      } else {
        const res = await majik.createAccount(passphrase, label)
        accountID = res.id
        // provide backup for download immediately
        const blob = new Blob([res.backup], {
          type: 'application/octet-stream'
        })
        downloadBlob(blob, 'txt', `${label} | ${res.id} | BACKUP KEY`)
      }

      toast.success('Account Created Successfully', {
        description: `New Account for ${label || accountID} created successfully.`,
        id: `toast-success-create-${label}`
      })
      window.electron.notify(
        'Account Created Successfully',
        `New Account for ${label || accountID} created successfully.`
      )

      setLabel('')
      setPassphrase('')
      setMnemonic('')
      setMnemonicJSON(undefined)
      onUpdate?.(majik)
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      console.error(err)
      toast.error('Account Creation Failed', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: 'error-majik-message-account-create'
      })
    }
  }

  const handleEditLabel = async (id: string, newName: string): Promise<void> => {
    try {
      majik.updateContactMeta(id, { label: newName })
      toast.success('Display Name Updated', {
        description: `Display name for ${id} updated successfully.`,
        id: 'success-majik-message-account-label-update'
      })
      onUpdate?.(majik)
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      console.error(err)
      toast.error('Update Failed', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: 'error-majik-message-account-edit'
      })
    }
  }

  const handleShare = async (id: string): Promise<void> => {
    const s = await majik.exportContactAsString(id)
    if (!s) {
      toast.error('Failed to copy to clipboard', {
        description: s,
        id: `toast-error-share-${id}`
      })
      return
    }
    try {
      await navigator.clipboard.writeText(s)
      toast.success('Invite Key copied to clipboard', {
        description: s,
        id: `toast-success-share-${id}`
      })
    } catch (err) {
      // fallback: show in prompt
      toast.error('Failed to copy to clipboard', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: `toast-error-share-${id}`
      })
    }
  }

  const handleGetPublicKey = async (contact: MajikContact): Promise<void> => {
    const pkey = await contact.getPublicKeyBase64()
    if (!pkey) {
      toast.error('Failed to copy to clipboard', {
        description: pkey,
        id: `toast-error-get-key-${pkey}`
      })
      return
    }
    try {
      await navigator.clipboard.writeText(pkey)
      toast.success('Public Key copied to clipboard', {
        description: pkey,
        id: `toast-success-get-key-${pkey}`
      })
    } catch (err) {
      // fallback: show in prompt
      toast.error('Failed to copy to clipboard', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: `toast-error-get-key-${pkey}`
      })
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    try {
      // Delete from KeyStore storage then remove from majik's in-memory list
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (majik as any).keyStore?.deleteIdentity?.(id).catch?.(() => {})
      // Try using KeyStore API directly if available
      try {
        const { KeyStore } = await import('@majikah/majik-message')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (KeyStore as any).deleteIdentity(id)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // ignore
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((majik as any).removeOwnAccount) (majik as any).removeOwnAccount(id)
      onUpdate?.(majik)
      setRefreshKey((prev) => prev + 1)
    } catch (err) {
      console.error(err)
      toast.error('Delete Failed', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: 'error-majik-message-account-delete'
      })
    }
  }

  const handleEditPassphrase = async (input: PassphraseUpdateParams): Promise<void> => {
    try {
      majik.updatePassphrase(input.passphrase.old, input.passphrase.new, input.id)
      onUpdate?.(majik)
      setRefreshKey((prev) => prev + 1)

      const accountDisplayName = await majik.getContactByID(input.id)?.getDisplayName()

      toast.success('Passphrase Updated', {
        description: `Passphrase for ${accountDisplayName} updated successfully.`,
        id: 'success-majik-message-account-passphrase-update'
      })
    } catch (err) {
      console.error(err)
      toast.error('Update Failed', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (err as any)?.message || err,
        id: 'error-majik-message-account-passphrase-update'
      })
    }
  }

  const handleLoadMnemonicAccount = async (): Promise<void> => {
    if (!majik) {
      toast.error('Problem Loading Majik Message')
      return
    }

    if (!mnemonicJSON) {
      toast.error('Invalid Backup File', {
        description: 'There seems to be a problem with the backup file.'
      })
      return
    }
    try {
      await majik.importAccountFromMnemonicBackup(
        mnemonicJSON.id,
        mnemonic.trim(),
        mnemonicJSON.phrase || '',
        label
      )

      setLabel('')
      setPassphrase('')
      setMnemonic('')
      setMnemonicJSON(undefined)

      toast.success('Account imported from mnemonic backup')
      onUpdate?.(majik)
      setRefreshKey((k) => k + 1)
    } catch (e) {
      console.error(e)
      toast.error('Failed to import mnemonic backup', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e
      })
    }
  }

  const handleSetAsActive = async (contact: MajikContact): Promise<void> => {
    if (!contact?.id?.trim()) {
      toast.error('Failed to set this account as active', {
        description: 'Unknown ID',
        id: `toast-error-active-missing-id`
      })
      return
    }
    try {
      const changeAccountResponse = await majik.setActiveAccount(contact.id)

      if (!changeAccountResponse) {
        toast.error('Unauthorized Access', {
          description: `Failed to set this account as active due to incorrect password`,
          id: `toast-error-active-${contact.id}`
        })
        return
      }
      majik.clearConversationCaches()
      majik.clearIdentity()
      setRefreshKey((prev) => prev + 1)
      toast.success('Switched to this Account', {
        description: `${contact?.meta?.label || contact.id}`,
        id: `toast-success-switch-account-${contact.id}`
      })
    } catch (e) {
      toast.error('Failed to set this account as active', {
        description: `${e}`,
        id: `toast-error-active-${contact.id}`
      })
    }
  }

  const processRegisterOnline = async (contact: MajikContact): Promise<string> => {
    if (contact.isMajikahRegistered()) {
      throw new Error('This account is already registered online.')
    }

    const createIdentityResponse = await majik.createIdentity(contact)

    if (createIdentityResponse !== null && createIdentityResponse.message) {
      return `Awesome! Your account for ${createIdentityResponse.data.public_key} is now registered online!`
    } else {
      const publickey = await contact.getPublicKeyBase64()

      return `Oh no... There's a problem while creating an online account for ${publickey}`
    }
  }

  const handleRegisterOnline = async (contact: MajikContact): Promise<void> => {
    try {
      toast.promise(processRegisterOnline(contact), {
        loading: `Registering Online...`,
        success: (outputMessage) => {
          setTimeout(() => {}, 1000)
          onUpdate?.(majik)
          setRefreshKey((prev) => prev + 1)
          return outputMessage
        },
        error: (error) => {
          return `${error.message}`
        }
      })
    } catch (err) {
      toast.error('Online Registration Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: `toast-error-register`
      })
    }
  }

  const handleUpdatePassphrase = (value: string): void => {
    if (!value?.trim()) {
      setPassphrase('')
      return
    }
    setPassphrase(value)
  }

  const handleSeedKeyChange = (input: MnemonicJSON): void => {
    if (!input || input.seed.length <= 0) return
    setMnemonicJSON(input)
    const stringSeed = jsonToSeed(input)
    setMnemonic(stringSeed)
  }

  const userAccounts = useMemo(() => {
    return majik.listOwnAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey])

  return (
    <Container>
      <SectionTitleFrame>
        <Row>
          <h2>Accounts</h2>
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <PopUpFormButton
              scrollable
              icon={ImportIcon}
              text="Import"
              disabled={userAccounts.length >= MAX_ACCOUNT_LIMIT}
              modal={{
                title: 'Import Account',
                description:
                  userAccounts.length >= MAX_ACCOUNT_LIMIT
                    ? 'Max accounts reached.'
                    : 'Import an account from a mnemonic seed phrase.'
              }}
              buttons={{
                cancel: {
                  text: 'Cancel'
                },
                confirm: {
                  text: 'Save Changes',
                  isDisabled:
                    !mnemonicJSON?.id?.trim() ||
                    !mnemonicJSON ||
                    mnemonicJSON.seed.length === 0 ||
                    !passphrase?.trim(),
                  onClick: handleLoadMnemonicAccount
                }
              }}
            >
              <CustomInputField
                onChange={(e) => setLabel(e)}
                maxChar={100}
                regex="letters"
                label="Display Name"
                currentValue={label}
                sensitive={true}
              />
              <SeedKeyInput
                importProp={{
                  type: 'json'
                }}
                requireBackupKey={true}
                onUpdatePassphrase={handleUpdatePassphrase}
                onChange={handleSeedKeyChange}
                currentValue={mnemonicJSON}
              />
            </PopUpFormButton>

            <PopUpFormButton
              scrollable
              icon={PlusIcon}
              text="Create Account"
              disabled={userAccounts.length >= MAX_ACCOUNT_LIMIT}
              modal={{
                title: 'Create Account',
                description:
                  userAccounts.length >= MAX_ACCOUNT_LIMIT
                    ? 'Max accounts reached.'
                    : 'Create a new account with a mnemonic seed phrase.'
              }}
              buttons={{
                cancel: {
                  text: 'Cancel'
                },
                confirm: {
                  text: 'Save Changes',
                  isDisabled: !label?.trim() || !mnemonicJSON || !passphrase?.trim(),
                  onClick: handleCreate
                }
              }}
            >
              <CustomInputField
                onChange={(e) => setLabel(e)}
                maxChar={100}
                regex="letters"
                label="Display Name"
                currentValue={label}
                required
                importProp={{
                  type: 'txt'
                }}
                sensitive={true}
              />
              <SeedKeyInput
                importProp={{
                  type: 'json'
                }}
                allowGenerate={true}
                onUpdatePassphrase={handleUpdatePassphrase}
                onChange={handleSeedKeyChange}
              />
            </PopUpFormButton>
          </div>
        </Row>
      </SectionTitleFrame>
      {userAccounts.length > 0 ? (
        <List>
          {userAccounts.map((a, index) => (
            <CBaseUserAccount
              key={a.id}
              index={index}
              itemData={a}
              onUpdateName={(name) => handleEditLabel(a.id, name)}
              onDelete={() => handleDelete(a.id)}
              onShare={() => handleShare(a.id)}
              onCopyPublicKey={handleGetPublicKey}
              onSetActive={(item) =>
                majik?.isAccountActive(item.id) ? undefined : handleSetAsActive(a)
              }
              onUpdatePassphrase={handleEditPassphrase}
              onRegister={handleRegisterOnline}
            />
          ))}
        </List>
      ) : (
        <DynamicPlaceholder> You haven&apos;t created any accounts yet.</DynamicPlaceholder>
      )}
    </Container>
  )
}

export default AccountsPanel
