import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { toast } from 'sonner'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DownloadSimpleIcon,
  IdentificationBadgeIcon,
  MagicWandIcon,
  ShieldCheckIcon,
  WifiHighIcon,
  WifiSlashIcon
} from '@phosphor-icons/react'

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle
} from '@/globals/styled-dialogs'
import CustomInputField from '@/components/foundations/CustomInputField'
import { SeedKeyInput } from '@/components/foundations/SeedKeyInput'
import type { MajikMessageDatabase } from '@/components/majik-context-wrapper/majik-message-database'
import { jsonToSeed, seedStringToArray, type MnemonicJSON } from '@majikah/majik-message'
import { prepareDownloadAnchor } from '@/utils/utils'

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`

// ─── Dialog overrides ─────────────────────────────────────────────────────────

const GateContent = styled(DialogContent)`
  max-width: 480px;
  width: 100%;
`

// ─── Step container ───────────────────────────────────────────────────────────

const StepWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 20px 8px;
  animation: ${fadeIn} 0.22s ease both;
`

// ─── Step progress dots ───────────────────────────────────────────────────────

const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 0 2px;
`

const Dot = styled.span<{ $active: boolean; $done: boolean }>`
  width: ${({ $active }) => ($active ? '20px' : '6px')};
  height: 6px;
  border-radius: 100px;
  transition: all 0.25s ease;
  background: ${({ $active, $done, theme }) =>
    $done
      ? theme.colors.accent || '#E05C1A'
      : $active
        ? theme.colors.textPrimary
        : theme.colors.secondaryBackground};
  opacity: ${({ $active, $done }) => ($active || $done ? 1 : 0.35)};
`

// ─── Icon badge ───────────────────────────────────────────────────────────────

const IconBadge = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  flex-shrink: 0;
`

const StepHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const StepTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  letter-spacing: -0.01em;
`

const StepHint = styled.p`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: 1.6;
  opacity: 0.7;
`

// ─── Choice cards ─────────────────────────────────────────────────────────────

const ChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`

const ChoiceCard = styled.button<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 14px 12px;
  border-radius: 10px;
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.accent || '#E05C1A' : theme.colors.secondaryBackground};
  background: ${({ $selected, theme }) =>
    $selected ? `${theme.colors.accent || '#E05C1A'}12` : theme.colors.secondaryBackground};
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.18s,
    background 0.18s;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.textSecondary};
  }
`

const ChoiceIcon = styled.span<{ $selected: boolean }>`
  color: ${({ $selected, theme }) =>
    $selected ? theme.colors.accent || '#E05C1A' : theme.colors.textSecondary};
  transition: color 0.18s;
`

const ChoiceLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`

const ChoiceDesc = styled.span`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.65;
  line-height: 1.5;
`

// ─── Account selector list ────────────────────────────────────────────────────

const AccountList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.secondaryBackground} transparent`};
`

const AccountRow = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.accent || '#E05C1A' : theme.colors.secondaryBackground};
  background: ${({ $selected, theme }) =>
    $selected ? `${theme.colors.accent || '#E05C1A'}12` : 'transparent'};
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s,
    background 0.15s;
  width: 100%;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.secondaryBackground};
  }
`

const AccountMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
`

const AccountName = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const AccountID = styled.span`
  font-family: 'Fira Mono', 'JetBrains Mono', monospace;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = styled.span<{ $online: boolean }>`
  font-family: 'Fira Mono', 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 100px;
  background: ${({ $online }) => ($online ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.12)')};
  color: ${({ $online }) => ($online ? '#22c55e' : '#9ca3af')};
  flex-shrink: 0;
`

// ─── Action footer ────────────────────────────────────────────────────────────

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 18px;
  border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  gap: 10px;
`

const SkipLink = styled.button`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.55;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;

  &:hover {
    opacity: 0.9;
  }
`

const NavButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const NavButton = styled.button<{ $primary?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity 0.15s,
    background 0.15s;
  border: 1px solid
    ${({ $primary, theme }) => ($primary ? theme.colors.primary : theme.colors.secondaryBackground)};
  background: ${({ $primary, theme }) => ($primary ? theme.colors.primary : 'transparent')};
  color: ${({ $primary, theme }) => ($primary ? '#fff' : theme.colors.textSecondary)};

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    opacity: 0.85;
  }
`

const ScrollContainer = styled.div`
  width: inherit;
  -webkit-overflow-scrolling: touch; // IMPORTANT for iOS
  touch-action: pan-y; // Allows drag scroll
  display: flex;
  flex-direction: column;
  height: 100%;

  padding: 1rem 50px;
  max-height: calc(85vh - 180px);
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.secondaryBackground};
    border-radius: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.gradients.primary};
    border-radius: 8px;
  }
`

// ─── Loading shimmer ──────────────────────────────────────────────────────────

const ShimmerText = styled.span`
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.textSecondary} 0%,
    ${({ theme }) => theme.colors.textPrimary} 50%,
    ${({ theme }) => theme.colors.textSecondary} 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${shimmer} 1.8s linear infinite;
`

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountMode = 'create' | 'import' | null

// Gate phases (in order):
// "account"    – no local accounts at all
// "register"   – has local accounts but none are online
// "tour"       – all gate steps satisfied, launch tour for first-time users
// "done"       – tour complete (or skipped), render children normally
type GatePhase = 'tour' | 'account' | 'register' | 'done'

interface MajikMessageOnboardingGateProps {
  children: React.ReactNode
  majik: MajikMessageDatabase
  onUpdate?: (updated: MajikMessageDatabase) => void
  /** Placeholder — replace with your Shepherd tour launcher */
  onLaunchTour?: () => Promise<void> | void
}

// ─── Component ────────────────────────────────────────────────────────────────

const MajikMessageOnboardingGate: React.FC<MajikMessageOnboardingGateProps> = ({
  children,
  majik,
  onUpdate,
  onLaunchTour
}) => {
  const [phase, setPhase] = useState<GatePhase | null>(null) // null = still evaluating
  const [refreshKey, setRefreshKey] = useState(0)

  // ── Shared form state ──────────────────────────────────────────────────────
  const [label, setLabel] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [mnemonicJSON, setMnemonicJSON] = useState<MnemonicJSON | undefined>()
  const [mnemonic, setMnemonic] = useState('')

  // ── Account step sub-state ─────────────────────────────────────────────────
  const [accountMode, setAccountMode] = useState<AccountMode>(null)

  // ── Register step sub-state ────────────────────────────────────────────────
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)

  // ── Tour guard — fires only once, after all gate steps finish ──────────────
  const tourFiredRef = useRef(false)
  // ── Tracks whether the user started with zero accounts (brand-new) ──────────
  const isFirstTimeUserRef = useRef(false)

  useEffect(() => {
    const accounts = majik.listOwnAccounts()
    const hasAccounts = accounts.length > 0
    const hasOnline = accounts.some((a) => a.isMajikahRegistered())

    if (!hasAccounts) {
      tourFiredRef.current = false
      isFirstTimeUserRef.current = true // ← mark as first-time
      setPhase('account')
    } else if (!hasOnline) {
      // Has local accounts but none online — returning user who stayed offline.
      // Do NOT mark as first-time; skip tour entirely.
      isFirstTimeUserRef.current = false
      setPhase('register')
    } else {
      setPhase('tour') // tour trigger guards itself with both refs
    }
  }, [majik, refreshKey])

  // ── Tour trigger — runs only after account + register steps are done ───────
  useEffect(() => {
    if (phase !== 'tour' || tourFiredRef.current) return

    // Only launch for users who started with zero accounts
    if (!isFirstTimeUserRef.current) {
      setPhase('done')
      return
    }

    tourFiredRef.current = true

    const runTour = async (): Promise<void> => {
      try {
        await onLaunchTour?.()
      } catch {
        // tour error is non-fatal
      } finally {
        setPhase('done')
      }
    }

    void runTour()
  }, [phase, onLaunchTour])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const resetForm = useCallback((): void => {
    setLabel('')
    setPassphrase('')
    setMnemonic('')
    setMnemonicJSON(undefined)
  }, [])

  const handleSeedKeyChange = (input: MnemonicJSON): void => {
    if (!input || input.seed.length <= 0) return
    setMnemonicJSON(input)
    setMnemonic(jsonToSeed(input))
  }

  const handleUpdatePassphrase = (value: string): void => {
    setPassphrase(value?.trim() ? value : '')
  }

  const refresh = (): void => setRefreshKey((k) => k + 1)

  // ── Advance phase after account is created/imported ────────────────────────
  //
  // Check whether the new account is already registered online. If it is,
  // skip the register step and go straight to the tour. Otherwise show register.

  const advanceAfterAccount = async (accountId: string): Promise<void> => {
    try {
      const doesExist = await majik.identityExists(accountId)
      majik.setContactMajikahStatus(accountId, doesExist)
      setPhase(doesExist ? 'tour' : 'register')
    } catch {
      // Network error — fall back to the register step so the user can retry
      setPhase('register')
    }
  }
  // ── Create account ─────────────────────────────────────────────────────────

  const handleCreateAccount = async (): Promise<void> => {
    if (!mnemonic?.trim() || !passphrase?.trim() || !label?.trim()) return

    const download = prepareDownloadAnchor('json', `${label} | SEED KEY`)

    const run = async (): Promise<string> => {
      const created = await majik.createAccountFromMnemonic(mnemonic.trim(), passphrase, label)

      const jsonData: MnemonicJSON = {
        id: created.backup,
        seed: seedStringToArray(mnemonic.trim()),
        phrase: passphrase?.trim() ? passphrase.trim() : undefined
      }

      const blob = new Blob([JSON.stringify(jsonData)], {
        type: 'application/json;charset=utf-8'
      })
      download.trigger(blob)

      resetForm()
      onUpdate?.(majik)
      refresh()

      // Check online status before deciding next phase
      await advanceAfterAccount(created.id)

      return `Account "${label}" created.`
    }

    toast.promise(run(), {
      loading: 'Creating account…',
      success: (m) => m,
      error: (e) => e?.message || 'Failed to create account.'
    })
  }

  // ── Import account ─────────────────────────────────────────────────────────

  const handleImportAccount = async (): Promise<void> => {
    if (!mnemonicJSON?.id?.trim() || !passphrase?.trim()) return

    const run = async (): Promise<string> => {
      const imported = await majik.importAccountFromMnemonicBackup(
        mnemonicJSON.id,
        mnemonic.trim(),
        passphrase.trim(),
        label
      )
      resetForm()
      onUpdate?.(majik)
      refresh()

      // Check online status before deciding next phase
      await advanceAfterAccount(imported.id)

      return 'Account imported.'
    }

    toast.promise(run(), {
      loading: 'Importing account…',
      success: (m) => m,
      error: (e) => e?.message || 'Failed to import account.'
    })
  }

  // ── Register online ────────────────────────────────────────────────────────

  const handleRegisterOnline = async (): Promise<void> => {
    if (!selectedAccountId) return

    const contact = majik.getOwnAccountById(selectedAccountId)
    if (!contact) return

    setIsRegistering(true)
    try {
      await majik.createIdentity(contact)
      toast.success('Registered online!', {
        description: `Account is now discoverable on Majikah.`
      })
      onUpdate?.(majik)
      refresh()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error('Registration failed', { description: e?.message })
    } finally {
      setIsRegistering(false)
    }
  }

  // ── "Stay offline" from register step — still launch tour ─────────────────

  const handleStayOffline = (): void => {
    setPhase('tour')
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const localAccounts = useMemo(
    () => majik.listOwnAccounts(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majik, refreshKey]
  )

  const unregisteredAccounts = useMemo(
    () => localAccounts.filter((a) => !a.isMajikahRegistered()),
    [localAccounts]
  )

  // ── Render guard ───────────────────────────────────────────────────────────

  // Still evaluating, tour running, or fully complete — render children
  if (phase === null || phase === 'tour' || phase === 'done') {
    return <>{children}</>
  }

  // ── STEP: account creation / import ───────────────────────────────────────

  if (phase === 'account') {
    const totalSteps = accountMode ? 2 : 1
    const currentStep = accountMode ? 2 : 1

    const canProceed =
      accountMode === 'create'
        ? !!label?.trim() && !!mnemonicJSON && !!passphrase?.trim()
        : accountMode === 'import'
          ? !!mnemonicJSON?.id?.trim() && mnemonicJSON.seed.length > 0 && !!passphrase?.trim()
          : false

    return (
      <>
        {children}
        <AlertDialog.Root open>
          <AlertDialog.Portal>
            <DialogOverlay />
            <GateContent>
              <DialogHeader>
                <DialogTitle>Welcome to Majik Message</DialogTitle>
                <DialogDescription>Set up your first account to get started.</DialogDescription>
              </DialogHeader>
              <ScrollContainer>
                <StepWrapper>
                  <ProgressRow>
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <Dot key={i} $active={i === currentStep - 1} $done={i < currentStep - 1} />
                    ))}
                  </ProgressRow>

                  {/* Step 1 — choose mode */}
                  {!accountMode && (
                    <>
                      <StepHeader>
                        <IconBadge>
                          <ShieldCheckIcon size={22} />
                        </IconBadge>
                        <StepTitle>Create or Import an Account</StepTitle>
                        <StepHint>
                          Your account is stored locally and protected by a seed phrase. No server
                          ever sees your keys.
                        </StepHint>
                      </StepHeader>

                      <ChoiceGrid>
                        <ChoiceCard
                          $selected={false}
                          onClick={() => setAccountMode('create')}
                          type="button"
                        >
                          <ChoiceIcon $selected={false}>
                            <MagicWandIcon size={20} />
                          </ChoiceIcon>
                          <ChoiceLabel>Create New</ChoiceLabel>
                          <ChoiceDesc>Generate a fresh seed phrase and set a password.</ChoiceDesc>
                        </ChoiceCard>

                        <ChoiceCard
                          $selected={false}
                          onClick={() => setAccountMode('import')}
                          type="button"
                        >
                          <ChoiceIcon $selected={false}>
                            <DownloadSimpleIcon size={20} />
                          </ChoiceIcon>
                          <ChoiceLabel>Import Existing</ChoiceLabel>
                          <ChoiceDesc>Restore from a backup JSON file or seed phrase.</ChoiceDesc>
                        </ChoiceCard>
                      </ChoiceGrid>
                    </>
                  )}

                  {/* Step 2 — create form */}
                  {accountMode === 'create' && (
                    <>
                      <StepHeader>
                        <IconBadge>
                          <MagicWandIcon size={22} />
                        </IconBadge>
                        <StepTitle>Create a New Account</StepTitle>
                        <StepHint>
                          A seed key file will be downloaded automatically. Keep it safe — it&apos;s
                          the only way to recover your account.
                        </StepHint>
                      </StepHeader>

                      <CustomInputField
                        onChange={setLabel}
                        maxChar={100}
                        regex="letters"
                        label="Display Name"
                        currentValue={label}
                        required
                        sensitive
                      />
                      <SeedKeyInput
                        allowGenerate
                        importProp={{ type: 'json' }}
                        onUpdatePassphrase={handleUpdatePassphrase}
                        onChange={handleSeedKeyChange}
                      />
                    </>
                  )}

                  {/* Step 2 — import form */}
                  {accountMode === 'import' && (
                    <>
                      <StepHeader>
                        <IconBadge>
                          <DownloadSimpleIcon size={22} />
                        </IconBadge>
                        <StepTitle>Import an Existing Account</StepTitle>
                        <StepHint>
                          Load your backup JSON file and enter the password you used when creating
                          the account.
                        </StepHint>
                      </StepHeader>

                      <CustomInputField
                        onChange={setLabel}
                        maxChar={100}
                        regex="letters"
                        label="Display Name (optional)"
                        currentValue={label}
                        sensitive
                      />
                      <SeedKeyInput
                        requireBackupKey
                        importProp={{ type: 'json' }}
                        onUpdatePassphrase={handleUpdatePassphrase}
                        onChange={handleSeedKeyChange}
                        currentValue={mnemonicJSON}
                      />
                    </>
                  )}
                </StepWrapper>
              </ScrollContainer>

              <Footer>
                <div>
                  {accountMode && (
                    <NavButton
                      type="button"
                      onClick={() => {
                        setAccountMode(null)
                        resetForm()
                      }}
                    >
                      <ArrowLeftIcon size={13} />
                      Back
                    </NavButton>
                  )}
                </div>

                <NavButtons>
                  {accountMode && (
                    <NavButton
                      $primary
                      type="button"
                      disabled={!canProceed}
                      onClick={accountMode === 'create' ? handleCreateAccount : handleImportAccount}
                    >
                      {accountMode === 'create' ? 'Create Account' : 'Import Account'}
                      <ArrowRightIcon size={13} />
                    </NavButton>
                  )}
                </NavButtons>
              </Footer>
            </GateContent>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </>
    )
  }

  // ── STEP: register online ──────────────────────────────────────────────────

  if (phase === 'register') {
    return (
      <>
        {children}
        <AlertDialog.Root open>
          <AlertDialog.Portal>
            <DialogOverlay />
            <GateContent>
              <DialogHeader>
                <DialogTitle>Go Online with Majikah</DialogTitle>
                <DialogDescription>
                  Register an account to send and receive messages on the network.
                </DialogDescription>
              </DialogHeader>

              <StepWrapper>
                <ProgressRow>
                  <Dot $active={false} $done />
                  <Dot $active $done={false} />
                </ProgressRow>

                <StepHeader>
                  <IconBadge>
                    <CloudArrowUpIcon size={22} />
                  </IconBadge>
                  <StepTitle>Register an Account Online</StepTitle>
                  <StepHint>
                    Registering links your public key to the Majikah network so others can message
                    you. Your private key never leaves your device.
                  </StepHint>
                </StepHeader>

                {unregisteredAccounts.length === 0 ? (
                  <StepHint style={{ textAlign: 'center', padding: '20px 0' }}>
                    All local accounts are already registered online.
                  </StepHint>
                ) : (
                  <AccountList>
                    {unregisteredAccounts.map((account) => (
                      <AccountRow
                        key={account.id}
                        $selected={selectedAccountId === account.id}
                        type="button"
                        onClick={() => setSelectedAccountId(account.id)}
                      >
                        <IdentificationBadgeIcon
                          size={18}
                          weight={selectedAccountId === account.id ? 'fill' : 'regular'}
                          style={{ flexShrink: 0 }}
                        />
                        <AccountMeta>
                          <AccountName>{account.meta?.label || 'Unnamed Account'}</AccountName>
                          <AccountID>{account.id}</AccountID>
                        </AccountMeta>
                        <StatusBadge $online={false}>offline</StatusBadge>
                        {selectedAccountId === account.id && (
                          <CheckCircleIcon size={14} color="#E05C1A" weight="fill" />
                        )}
                      </AccountRow>
                    ))}
                  </AccountList>
                )}
              </StepWrapper>

              <Footer>
                {/* "Stay offline" still launches the tour — user has completed
                    the mandatory gate steps, they just chose not to register */}
                <SkipLink type="button" onClick={handleStayOffline}>
                  <WifiSlashIcon size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Stay offline for now
                </SkipLink>

                <NavButtons>
                  <NavButton
                    $primary
                    type="button"
                    disabled={!selectedAccountId || isRegistering}
                    onClick={handleRegisterOnline}
                  >
                    {isRegistering ? (
                      <ShimmerText>Registering…</ShimmerText>
                    ) : (
                      <>
                        <WifiHighIcon size={13} />
                        Register Online
                      </>
                    )}
                  </NavButton>
                </NavButtons>
              </Footer>
            </GateContent>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </>
    )
  }

  return <>{children}</>
}

export default MajikMessageOnboardingGate
