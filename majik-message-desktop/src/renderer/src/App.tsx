import { useEffect, useMemo, useState, type JSX } from 'react'

import { toast } from 'sonner'

import styled from 'styled-components'

import {
  AddressBookIcon,
  ChatIcon,
  EnvelopeIcon,
  PaperPlaneIcon,
  StarFourIcon,
  UserIcon
} from '@phosphor-icons/react'
import { useMajik } from './components/majik-context-wrapper/use-majik'
import {
  jsonToSeed,
  KeyStore,
  MajikContact,
  seedStringToArray,
  type MnemonicJSON
} from '@majikah/majik-message'
import DynamicPlaceholder from './components/foundations/DynamicPlaceholder'
import AccountsPanel from './components/panels/AccountsPanel'

import ContactsPanel from './components/panels/ContactsPanel'
import MessagePanel from './components/panels/MessagePanel'
import UnlockModal from './components/UnlockModal'

import MajikahPanel from './components/panels/MajikahPanel'
import { TabRouter, type RouterTabContent } from './components/functional/TabRouter'
import type { MajikMessageDatabase } from './components/majik-context-wrapper/majik-message-database'
import ConversationSidePanel from './components/panels/conversations/ConversationSidePanel'
import { NotificationDot } from './components/functional/Notification/NotificationDot'
import type { ElectronAPI } from './global'
import { useNavigate } from 'react-router-dom'
import DynamicPopUp from './components/functional/DynamicPopUp'
import CustomInputField from './components/foundations/CustomInputField'
import { SeedKeyInput } from './components/foundations/SeedKeyInput'
import { downloadBlob } from './utils/utils'
import { useMajikah } from './components/majikah-session-wrapper/use-majikah'
import EmailThreads from './components/panels/threads/EmailThreads'
import { useDispatch } from 'react-redux'
import { toggleTheme } from './redux/slices/system'

const RootContainer = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: inherit;
  background-color: ${({ theme }) => theme.colors.primaryBackground};
  height: 100vh;
  width: 100vw;
`
// Type guard for Electron API
const isElectron = (): false | ElectronAPI => typeof window !== 'undefined' && window.electron

const MAX_ACCOUNT_LIMIT = 25

function App(): JSX.Element {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const { majik, loading, updateInstance } = useMajik()
  const { majikah } = useMajikah()
  const [unlockId, setUnlockId] = useState<string | null>(null)
  const [unlockResolver, setUnlockResolver] = useState<((s: string) => void) | null>(null)
  const [unlocked, setUnlocked] = useState<boolean>(false)

  const [isCreatingAccount, setIsCreatingAccount] = useState<boolean>(false)
  const [isAddingContact, setIsAddingContact] = useState<boolean>(false)

  const [refreshKey, setRefreshKey] = useState<number>(0)

  const [label, setLabel] = useState<string>('')
  const [passphrase, setPassphrase] = useState<string>('')
  const [mnemonic, setMnemonic] = useState<string>('')

  const [inviteKey, setInviteKey] = useState<string>('')

  useEffect(() => {
    // Wire KeyStore.onUnlockRequested to present our React modal
    KeyStore.onUnlockRequested = (id: string) => {
      return new Promise<string>((resolve) => {
        setUnlockId(id)
        setUnlockResolver(() => resolve)
      })
    }

    return () => {
      KeyStore.onUnlockRequested = undefined
    }
  }, [])

  useEffect(() => {
    // define an async function inside useEffect
    const unlockIdentity = async (): Promise<void> => {
      try {
        if (!majik) return
        const activeAccount = majik.getActiveAccount()
        if (!activeAccount) return
        await majik.ensureIdentityUnlocked(activeAccount.id)
        toast.success('Access granted', {
          description: 'Your identity has been securely unlocked.',
          id: 'toast-success-unlock'
        })

        console.log('Access granted: Identity unlocked')
      } catch (err) {
        toast.error('Unlock failed', {
          description: `Incorrect passphrase. Please try again. ${err}`,
          id: 'toast-error-unlock'
        })
        console.warn('Failed to unlock identity:', err)
      }
    }

    // call the async function
    unlockIdentity()
  }, [majik]) // add dependencies as needed

  // Handle import from Electron menu
  useEffect(() => {
    if (!isElectron()) return

    const handleImport = async (): Promise<void> => {
      try {
        navigate('/accounts')
        const result = await window.electron.importAccount()
        if (!result) return

        if (userAccounts.length >= MAX_ACCOUNT_LIMIT) {
          toast.error('Account Limit Reached', {
            description: `You have reached the maximum limit of ${MAX_ACCOUNT_LIMIT} accounts.`,
            id: 'toast-error-account-limit'
          })
          window.electron.notify(
            'Account Limit Reached',
            `You have reached the maximum limit of ${MAX_ACCOUNT_LIMIT} accounts.`
          )
          return
        }

        const { base64Content } = result

        // Decrypt using your existing logic
        const json = JSON.parse(base64Content) as MnemonicJSON
        if (!json) {
          toast.error('Invalid Backup File', {
            description: 'There seems to be a problem with the backup file.'
          })
          return
        }
        const stringSeed = jsonToSeed(json)
        await majik.importAccountFromMnemonicBackup(json.id, stringSeed, json.phrase || '')

        toast.success('Account imported from mnemonic backup')
        setRefreshKey((k) => k + 1)
      } catch (error) {
        console.error(error)
        toast.error('Failed to import mnemonic backup', {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (error as any)?.message || error
        })
      }
    }
    const handleCreate = async (): Promise<void> => {
      navigate('/accounts')
      if (userAccounts.length >= MAX_ACCOUNT_LIMIT) {
        toast.error('Account Limit Reached', {
          description: `You have reached the maximum limit of ${MAX_ACCOUNT_LIMIT} accounts.`,
          id: 'toast-error-account-limit'
        })
        window.electron.notify(
          'Account Limit Reached',
          `You have reached the maximum limit of ${MAX_ACCOUNT_LIMIT} accounts.`
        )
        return
      }

      setIsCreatingAccount(true)
    }

    const handleContact = async (): Promise<void> => {
      navigate('/contacts')

      setIsAddingContact(true)
    }

    const handleSignIn = async (): Promise<void> => {
      navigate('/majikah')
    }

    const handleSignOut = async (): Promise<void> => {
      if (!majikah.isAuthenticated) return
      const user = majikah.user

      try {
        await majikah.signOut()
        toast.success('Signed Out', {
          description: `You've successfully signed out from Majikah, ${user?.displayName || user?.email}.`,
          id: `toast-success-sign-out`
        })
        window.electron.notify(
          'Signed Out',
          `You've successfully signed out from Majikah, ${user?.displayName || user?.email}.`
        )
      } catch {
        toast.error('Problem Signing Out', {
          description: `There was a problem signing out from Majikah, ${user?.displayName || user?.email}.`,
          id: 'toast-error-sign-out'
        })
        window.electron.notify(
          'Problem Signing Out',
          `There was a problem signing out from Majikah, ${user?.displayName || user?.email}.`
        )
      } finally {
        navigate('/majikah')
      }
    }

    const handleToggleDarkmode = async (): Promise<void> => {
      dispatch(toggleTheme())
    }
    const removeToggleDarkMode = window.electron.onToggleDarkMode(handleToggleDarkmode)

    const removeCreateListener = window.electron.onCreateAccountTriggered(handleCreate)

    const removeImportListener = window.electron.onImportAccountTriggered(handleImport)

    const removeAddContactListener = window.electron.onImportContactTriggered(handleContact)

    const removeSignInListener = window.electron.onSignInTriggered(handleSignIn)

    const removeSignOutListener = window.electron.onSignOutTriggered(handleSignOut)

    return () => {
      removeToggleDarkMode()
      removeImportListener()

      removeCreateListener()
      removeAddContactListener()

      removeSignInListener()
      removeSignOutListener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleAddContact = async (): Promise<void> => {
    if (!inviteKey?.trim()) {
      toast.error('Invalid Invite Key', {
        description: 'Please provide a valid invite key.',
        id: `toast-error-add-${inviteKey}`
      })
      return
    }
    try {
      await majik.importContactFromString(inviteKey)
      setRefreshKey((prev) => prev + 1)
      toast.success('New Contact Added Succesfully', {
        description: inviteKey,
        id: `toast-success-add-${inviteKey}`
      })

      window.electron.notify('New Contact Added Succesfully', inviteKey)
    } catch (e) {
      toast.error('Failed to Add New Contact', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: 'error-majik-add'
      })
    }
  }

  const handleCancel = (): void => {
    if (unlockResolver) unlockResolver('')
    setUnlockId(null)
    setUnlockResolver(null)
  }

  const handleSwitchAccount = async (newAccount: MajikContact): Promise<void> => {
    handleCancel()
    setUnlockId(newAccount.id)
    await majik.ensureIdentityUnlocked(newAccount.id)
    toast.success('Access granted', {
      description: 'Your identity has been securely unlocked.',
      id: 'toast-success-unlock'
    })
  }

  const handleSubmit = (pass: string): void => {
    if (unlockResolver) unlockResolver(pass)
    setUnlockId(null)
    setUnlockResolver(null)
    setUnlocked(true)
  }

  const handleRefreshInstance = (data: MajikMessageDatabase): void => {
    updateInstance(data)
    setRefreshKey((prev) => prev + 1)
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

    const stringSeed = jsonToSeed(input)
    setMnemonic(stringSeed)
  }

  const userAccounts = useMemo(() => {
    return majik.listOwnAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey])

  if (loading) {
    return (
      <RootContainer>
        <DynamicPlaceholder loading>Loading...</DynamicPlaceholder>
      </RootContainer>
    )
  }

  const tabs: RouterTabContent[] = [
    {
      id: 'accounts',
      route: '/accounts',
      icon: UserIcon,
      name: 'Accounts',
      element: <AccountsPanel majik={majik} onUpdate={handleRefreshInstance} />
    },
    {
      id: 'chats',
      route: '/chats',
      name: 'Chats',
      icon: ChatIcon,
      element: <ConversationSidePanel majik={majik} onUpdate={handleRefreshInstance} />,
      notification: <NotificationDot />
    },
    {
      id: 'threads',
      route: '/threads',
      name: 'Threads',
      icon: PaperPlaneIcon,
      element: <EmailThreads majik={majik} onUpdate={handleRefreshInstance} />
      // notification: <NotificationDot />
    },
    {
      id: 'contacts',
      route: '/contacts',
      name: 'Contacts',
      icon: AddressBookIcon,
      element: <ContactsPanel majik={majik} onUpdate={handleRefreshInstance} />
    },
    {
      id: 'messsage',
      route: '/message',
      name: 'Message',
      icon: EnvelopeIcon,
      element: <MessagePanel majik={majik} />
    },
    {
      id: 'majikah',
      route: '/majikah',
      name: 'Majikah',
      icon: StarFourIcon,
      element: <MajikahPanel majik={majik} onUpdate={handleRefreshInstance} />
    }
  ]

  return (
    <RootContainer>
      <TabRouter tabs={tabs} />
      <UnlockModal
        identityId={unlockId}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        majik={majik}
        strict={!unlocked}
        onSignout={() => setUnlockId(null)}
        onSwitchAccount={handleSwitchAccount}
        onReset={handleCancel}
      />
      <DynamicPopUp
        scrollable
        isOpen={isCreatingAccount}
        onOpenChange={setIsCreatingAccount}
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
            isDisabled: !label?.trim() || !mnemonic?.trim() || !passphrase?.trim(),
            onClick: handleCreate
          }
        }}
      >
        <CustomInputField
          onChange={(e) => setLabel(e)}
          maxChar={100}
          regex="letters"
          label="Display Name"
          required
          importProp={{
            type: 'txt'
          }}
          currentValue={label}
        />
        <SeedKeyInput
          importProp={{
            type: 'json'
          }}
          allowGenerate={true}
          onUpdatePassphrase={handleUpdatePassphrase}
          onChange={handleSeedKeyChange}
        />
      </DynamicPopUp>

      <DynamicPopUp
        scrollable
        isOpen={isAddingContact}
        onOpenChange={setIsAddingContact}
        modal={{
          title: 'Add Contact',
          description: 'Add a new contact to your list.'
        }}
        buttons={{
          cancel: {
            text: 'Cancel'
          },
          confirm: {
            text: 'Save Changes',
            onClick: handleAddContact
          }
        }}
      >
        <CustomInputField
          currentValue={inviteKey}
          onChange={(e) => setInviteKey(e)}
          maxChar={500}
          label="Invite Key"
          required
          importProp={{
            type: 'txt'
          }}
          sensitive={true}
        />
      </DynamicPopUp>
    </RootContainer>
  )
}

export default App
