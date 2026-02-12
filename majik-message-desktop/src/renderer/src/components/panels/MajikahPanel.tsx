/* eslint-disable @typescript-eslint/no-explicit-any */
import styled from 'styled-components'

import { SectionTitle, SectionTitleFrame } from '../../globals/styled-components'

import UserAuth from '../foundations/UserAuth'

import { useMajikah } from '../majikah-session-wrapper/use-majikah'
import DynamicUserProfile from '../functional/DynamicUserProfile'
import {
  MAX_IDENTITY_LIMIT,
  type MajikMessageDatabase
} from '../majik-context-wrapper/majik-message-database'
import { useCallback, useEffect, useState } from 'react'
import PopUpFormButton from '../foundations/PopUpFormButton'
import { PlusIcon } from '@phosphor-icons/react'
import type { MajikContact, MajikMessageIdentity } from '@majikah/majik-message'
import { toast } from 'sonner'
import { MajikContactSelector } from '../MajikContactSelector'
import DynamicPlaceholder from '../foundations/DynamicPlaceholder'
import WindowDataTable from '../functional/WindowDataTable'
import { columnsAccountIdentities } from '../tables/identities/columns-account-identities'
import ThemeToggle from '../functional/ThemeToggle'
import ConfirmationButton from '../foundations/ConfirmationButton'
import { useNavigate } from 'react-router-dom'

const Container = styled.div`
  width: inherit;
  height: auto;
  padding: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 16px;

  margin-bottom: 100px;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const LoadingOverlay = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
`

interface MajikahPanelProps {
  majik: MajikMessageDatabase
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void
}

// ======== Main Component ========

const MajikahPanel: React.FC<MajikahPanelProps> = ({ majik }) => {
  const { majikah } = useMajikah()
  const navigate = useNavigate()

  const [refreshKey, setRefreshKey] = useState<number>(0)
  const [loading, setIsLoading] = useState<boolean>(false)
  const [currentIdentities, setCurrentIdentities] = useState<MajikMessageIdentity[]>([])
  const [selectedAccount, setSelectedAccount] = useState<MajikContact | null>(null)

  const loadIdentities = useCallback(async () => {
    if (!majikah || !majikah.isAuthenticated) return
    try {
      setIsLoading(true)
      const fetchedIdentities = await majik.refreshIdentities()

      if (!fetchedIdentities.length) {
        setCurrentIdentities([])
        return
      }

      setCurrentIdentities(fetchedIdentities)

      // setAllowNextPage(messages.length > 0)
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Failed to refresh messages', { description: error?.message })
      }
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, majikah?.isAuthenticated])

  useEffect(() => {
    loadIdentities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

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

  const handleRegisterOnline = (): void => {
    if (!selectedAccount) {
      toast.error('Missing Account', {
        description: 'Please select an account to register online.',
        id: `toast-error-register`
      })
      return
    }

    try {
      toast.promise(processRegisterOnline(selectedAccount), {
        loading: `Registering Online...`,
        success: (outputMessage) => {
          setTimeout(() => {}, 1000)
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

  const processDeleteIdentity = async (account: MajikMessageIdentity): Promise<string> => {
    if (!account.validateIntegrity()) {
      throw new Error('This account is has been tampered.')
    }

    const deleteIdentityResponse = await majik.deleteIdentity(account)

    if (deleteIdentityResponse) {
      return `This account with a public key of ${account.publicKey} has been successfully deleted!`
    } else {
      const publickey = account.publicKey

      return `Oh no... There's a problem while deleting the account for ${publickey}`
    }
  }

  const handleDeleteIdentity = (account: MajikMessageIdentity): void => {
    if (!account) {
      toast.error('Missing Account', {
        description: 'Please select an account to delete.',
        id: `toast-error-delete`
      })
      return
    }

    try {
      toast.promise(processDeleteIdentity(account), {
        loading: `Deleting account...`,
        success: (outputMessage) => {
          setTimeout(() => {}, 1000)
          setRefreshKey((prev) => prev + 1)
          return outputMessage
        },
        error: (error) => {
          return `${error.message}`
        }
      })
    } catch (err) {
      toast.error('Deletion Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: `toast-error-delete`
      })
    }
  }

  const processDeleteUserData = async (): Promise<string> => {
    if (!majikah.user) {
      throw new Error('There seems to be a problem with the authenticated user.')
    }

    const currentUser = majikah.user

    const deleteUserResponse = await majikah.deleteUserData()

    if (deleteUserResponse.success) {
      return `This account with an email of ${currentUser.email} has been successfully deleted!`
    } else {
      return `Oh no... There's a problem while deleting the account for ${currentUser.email}`
    }
  }

  const handleDeleteUserData = (): void => {
    if (!majikah.isAuthenticated) {
      toast.error('Unauthenticated', {
        description: 'You must be logged in to delete your user data.',
        id: `toast-error-delete-user-data`
      })
      return
    }

    try {
      toast.promise(processDeleteUserData(), {
        loading: `Deleting user data...`,
        success: (outputMessage) => {
          setTimeout(() => {}, 1000)
          setRefreshKey((prev) => prev + 1)
          return outputMessage
        },
        error: (error) => {
          return `${error.message}`
        }
      })
    } catch (err) {
      toast.error('Deletion Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: `toast-error-delete`
      })
    }
  }

  const handleSelectAccount = (selected: MajikContact): void => {
    if (!selected) return

    if (selected.isMajikahRegistered()) {
      toast.error('Already Registered Online', {
        description: 'This account is already registered online.',
        id: `toast-error-register`
      })
      return
    }
    setSelectedAccount(selected)
  }

  if (!majikah.isAuthenticated) {
    return (
      <Container>
        <ThemeToggle size={45} />
        <UserAuth />
      </Container>
    )
  }

  if (loading) {
    return (
      <Container>
        <LoadingOverlay>
          <DynamicPlaceholder loading>Loading...</DynamicPlaceholder>
        </LoadingOverlay>
      </Container>
    )
  }

  return (
    <Container>
      <section>
        {majikah.isAuthenticated && (
          <DynamicUserProfile
            session={majikah}
            userData={majikah.user!}
            onSignout={() => setRefreshKey((prev) => prev + 1)}
          />
        )}
      </section>

      <section>
        <SectionTitleFrame>
          <Row>
            <h2>Registered Identities</h2>
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <PopUpFormButton
                scrollable
                icon={PlusIcon}
                text="Register Account"
                disabled={currentIdentities.length >= MAX_IDENTITY_LIMIT}
                modal={{
                  title: 'Register Existing Account',
                  description:
                    currentIdentities.length >= MAX_IDENTITY_LIMIT
                      ? 'Max registered accounts reached.'
                      : 'Register an existing seed phrase account online for real time messaging, threads and other Majikah services.'
                }}
                buttons={{
                  cancel: {
                    text: 'Cancel'
                  },
                  confirm: {
                    text: 'Register',
                    isDisabled: !selectedAccount || loading,
                    onClick: handleRegisterOnline
                  }
                }}
              >
                <MajikContactSelector
                  contacts={majik.listOwnAccounts()}
                  tooltip="Select Account"
                  value={selectedAccount ?? undefined}
                  onUpdate={handleSelectAccount}
                  onClear={() => setSelectedAccount(null)}
                />
              </PopUpFormButton>
            </div>
          </Row>
        </SectionTitleFrame>

        <WindowDataTable
          key={refreshKey}
          columns={columnsAccountIdentities(undefined, undefined, handleDeleteIdentity)}
          data={[...currentIdentities]}
          loading={loading}
          onEmptyText="Create or import a seed phrase account to register your first online Majikah account."
          onEmptyActionButtonText="Create or Import Account"
          onEmptyActionClick={() => navigate('/accounts')}
          pagination={false}
        />
      </section>
      <section>
        <SectionTitle>Danger Zone</SectionTitle>
        <div style={{ width: '100%', display: 'flex' }}>
          <ConfirmationButton
            alertTextTitle="Delete Majikah Account"
            text="Delete Majikah Account"
            disabled={!majikah.isAuthenticated}
            strict={true}
            requiredText={majikah.user?.email || 'DELETE MAJIKAH ACCOUNT'}
            onClick={handleDeleteUserData}
          />
        </div>
      </section>
    </Container>
  )
}

export default MajikahPanel
