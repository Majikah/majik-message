/* eslint-disable @typescript-eslint/no-explicit-any */
import styled, { keyframes } from 'styled-components'

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

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Page shell ───────────────────────────────────────────────────────────────
const PageRoot = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 0 25px 100px;
  animation: ${fadeUp} 220ms cubic-bezier(0.4, 0, 0.2, 1) both;
`

// ─── Generic section wrapper ──────────────────────────────────────────────────
const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

// ─── Panel header (matches AccountsPanel / ConversationSidePanel / MajikahUserProfile) ──
const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
`

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const PanelTitle = styled.h2`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`

const PanelSubtitle = styled.p`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  opacity: 0.5;
  letter-spacing: 0.03em;
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

// ─── Limit badge (matches AccountsPanel pattern) ──────────────────────────────
const LimitBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 100px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  background: rgba(248, 113, 113, 0.1);
  color: ${({ theme }) => theme.colors.error ?? '#f87171'};
  border: 1px solid rgba(248, 113, 113, 0.2);
`

// ─── Danger zone card ─────────────────────────────────────────────────────────
/**
 * Red-tinted isolated card. Distinct enough that no one accidentally clicks
 * the delete button while scrolling. The header uses a lighter red background
 * and red text — same pattern as ExpiryPill in CBaseChatBubble.
 */
const DangerCard = styled.div`
  border: 1px solid rgba(248, 113, 113, 0.15);
  border-radius: 14px;
  overflow: hidden;
`

const DangerHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 13px;
  background: rgba(248, 113, 113, 0.04);
  border-bottom: 1px solid rgba(248, 113, 113, 0.12);
`

const DangerTitle = styled.h3`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.error ?? '#f87171'};
  letter-spacing: -0.01em;
  margin: 0;
`

const DangerSubtitle = styled.p`
  font-family: ${FONT_MONO};
  font-size: 10px;
  color: ${({ theme }) => theme.colors.error ?? '#f87171'};
  opacity: 0.45;
  margin: 3px 0 0;
  letter-spacing: 0.03em;
`

const DangerBody = styled.div`
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const DangerDescription = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.65;
  margin: 0;
  opacity: 0.7;
`

// ─── Loading / unauthenticated states ─────────────────────────────────────────
const StateWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  width: 100%;
  gap: 16px;
`

// ─── Props ────────────────────────────────────────────────────────────────────
interface MajikahPanelProps {
  majik: MajikMessageDatabase
  onUpdate?: (updatedInstance: MajikMessageDatabase) => void
}

// ─── Component ────────────────────────────────────────────────────────────────
const MajikahPanel: React.FC<MajikahPanelProps> = ({ majik }) => {
  const { majikah } = useMajikah()
  const navigate = useNavigate()

  const [refreshKey, setRefreshKey] = useState<number>(0)
  const [loading, setIsLoading] = useState<boolean>(false)
  const [currentIdentities, setCurrentIdentities] = useState<MajikMessageIdentity[]>([])
  const [selectedAccount, setSelectedAccount] = useState<MajikContact | null>(null)

  // ── Load identities ────────────────────────────────────────────────────────
  const loadIdentities = useCallback(async () => {
    if (!majikah || !majikah.isAuthenticated) return
    try {
      setIsLoading(true)
      const fetchedIdentities = await majik.refreshIdentities()
      setCurrentIdentities(fetchedIdentities.length ? fetchedIdentities : [])
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Failed to refresh identities', {
          description: error?.message
        })
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

  // ── Register identity ──────────────────────────────────────────────────────
  const processRegisterOnline = async (contact: MajikContact): Promise<string> => {
    if (contact.isMajikahRegistered()) {
      throw new Error('This account is already registered online.')
    }
    const createIdentityResponse = await majik.createIdentity(contact)
    if (createIdentityResponse !== null && createIdentityResponse.message) {
      return `Awesome! Your account for ${createIdentityResponse.data.public_key} is now registered online!`
    }
    const publickey = await contact.getPublicKeyBase64()
    return `Oh no... There's a problem while creating an online account for ${publickey}`
  }

  const handleRegisterOnline = (): void => {
    if (!selectedAccount) {
      toast.error('Missing Account', {
        description: 'Please select an account to register online.',
        id: 'toast-error-register'
      })
      return
    }
    try {
      toast.promise(processRegisterOnline(selectedAccount), {
        loading: 'Registering online…',
        success: (msg) => {
          setRefreshKey((p) => p + 1)
          return msg
        },
        error: (err) => err.message
      })
    } catch (err) {
      toast.error('Online Registration Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: 'toast-error-register'
      })
    }
  }

  // ── Delete identity ────────────────────────────────────────────────────────
  const processDeleteIdentity = async (account: MajikMessageIdentity): Promise<string> => {
    if (!account.validateIntegrity()) {
      throw new Error('This account has been tampered.')
    }
    const deleted = await majik.deleteIdentity(account)
    if (deleted) {
      return `Account with public key ${account.publicKey} deleted successfully.`
    }
    return `There was a problem deleting the account for ${account.publicKey}`
  }

  const handleDeleteIdentity = (account: MajikMessageIdentity): void => {
    if (!account) {
      toast.error('Missing Account', {
        description: 'Please select an account to delete.',
        id: 'toast-error-delete'
      })
      return
    }
    try {
      toast.promise(processDeleteIdentity(account), {
        loading: 'Deleting account…',
        success: (msg) => {
          setRefreshKey((p) => p + 1)
          return msg
        },
        error: (err) => err.message
      })
    } catch (err) {
      toast.error('Deletion Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: 'toast-error-delete'
      })
    }
  }

  // ── Delete user data ───────────────────────────────────────────────────────
  const processDeleteUserData = async (): Promise<string> => {
    if (!majikah.user) {
      throw new Error('There seems to be a problem with the authenticated user.')
    }
    const currentUser = majikah.user
    const response = await majikah.deleteUserData()
    if (response.success) {
      return `Account ${currentUser.email} deleted successfully.`
    }
    return `There was a problem deleting the account for ${currentUser.email}`
  }

  const handleDeleteUserData = (): void => {
    if (!majikah.isAuthenticated) {
      toast.error('Unauthenticated', {
        description: 'You must be logged in to delete your user data.',
        id: 'toast-error-delete-user-data'
      })
      return
    }
    try {
      toast.promise(processDeleteUserData(), {
        loading: 'Deleting user data…',
        success: (msg) => {
          setRefreshKey((p) => p + 1)
          return msg
        },
        error: (err) => err.message
      })
    } catch (err) {
      toast.error('Deletion Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: 'toast-error-delete'
      })
    }
  }

  // ── Select account for registration ───────────────────────────────────────
  const handleSelectAccount = (selected: MajikContact): void => {
    if (!selected) return
    if (selected.isMajikahRegistered()) {
      toast.error('Already Registered Online', {
        description: 'This account is already registered online.',
        id: 'toast-error-register'
      })
      return
    }
    setSelectedAccount(selected)
  }

  // ── Navigate to accounts page ──────────────────────────────────────────────
  const handleNavigateAccounts = async (): Promise<void> => {
    navigate('/accounts')
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const atLimit = currentIdentities.length >= MAX_IDENTITY_LIMIT
  const identityCount = currentIdentities.length

  // ── Unauthenticated state ──────────────────────────────────────────────────
  if (!majikah.isAuthenticated) {
    return (
      <StateWrap>
        <ThemeToggle size={45} />
        <UserAuth />
      </StateWrap>
    )
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <StateWrap>
        <DynamicPlaceholder loading>Loading…</DynamicPlaceholder>
      </StateWrap>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageRoot>
      {/* ── Section 1: Profile hero ── */}
      <Section>
        {majikah.isAuthenticated && (
          <DynamicUserProfile
            session={majikah}
            userData={majikah.user!}
            onSignout={() => setRefreshKey((p) => p + 1)}
          />
        )}
      </Section>

      {/* ── Section 2: Registered Identities ── */}
      <Section>
        <PanelHeader>
          <HeaderLeft>
            <PanelTitle>Registered Identities</PanelTitle>
            <PanelSubtitle>
              {identityCount} / {MAX_IDENTITY_LIMIT} registered online
            </PanelSubtitle>
          </HeaderLeft>

          <HeaderActions>
            {atLimit && <LimitBadge>Limit reached</LimitBadge>}

            <PopUpFormButton
              scrollable
              icon={PlusIcon}
              text="Register Account"
              disabled={atLimit}
              modal={{
                title: 'Register Existing Account',
                description: atLimit
                  ? 'Max registered accounts reached.'
                  : 'Register an existing seed phrase account online for real-time messaging, threads, and other Majikah services.'
              }}
              buttons={{
                cancel: { text: 'Cancel' },
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
          </HeaderActions>
        </PanelHeader>

        <WindowDataTable
          key={refreshKey}
          columns={columnsAccountIdentities(undefined, undefined, handleDeleteIdentity)}
          data={[...currentIdentities]}
          loading={loading}
          onEmptyText="Create or import a seed phrase account to register your first online Majikah identity."
          onEmptyActionButtonText="Create or Import Account"
          onEmptyActionClick={() => handleNavigateAccounts}
          disablePageNext
          disablePagePrevious
          showPagination={false}
        />
      </Section>

      {/* ── Section 3: Danger zone ── */}
      <Section>
        <DangerCard>
          <DangerHeader>
            <div>
              <DangerTitle>Danger Zone</DangerTitle>
              <DangerSubtitle>Irreversible actions · proceed with caution</DangerSubtitle>
            </div>
          </DangerHeader>

          <DangerBody>
            <DangerDescription>
              Permanently deletes your Majikah account, all registered identities, and associated
              user data. This action cannot be undone.
            </DangerDescription>

            <ConfirmationButton
              alertTextTitle="Delete Majikah Account"
              text="Delete Majikah Account"
              disabled={!majikah.isAuthenticated}
              strict
              requiredText={majikah.user?.email || 'DELETE MAJIKAH ACCOUNT'}
              onClick={handleDeleteUserData}
            />
          </DangerBody>
        </DangerCard>
      </Section>
    </PageRoot>
  )
}

export default MajikahPanel
