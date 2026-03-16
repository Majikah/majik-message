// FilePanel.tsx

import styled, { css, keyframes } from 'styled-components'
import { useState, useEffect, useMemo } from 'react'
import { FolderOpenIcon, ShieldCheckIcon, UserPlusIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import DynamicPlaceholder from '../foundations/DynamicPlaceholder'
import { ChoiceButton } from '@renderer/globals/buttons'
import { useLocation, useNavigate } from 'react-router-dom'
import FileVault from '../functional/FileVault/FileVault'
import { MajikKeyStore, type CompressionLevel, type MajikContact } from '@majikah/majik-message'
import MajikContactListSelector from '../MajikContactListSelector'
import PopUpFormButton from '../foundations/PopUpFormButton'
import CustomInputField from '../foundations/CustomInputField'
import DynamicSlidingDialogue from '../functional/DynamicSlidingDialogue'
import UserFiles from '../functional/UserFiles'
import { useMajikah } from '../majikah-session-wrapper/use-majikah'
import GuideHelper from '../functional/GuideHelper'
import type { DecryptResult, DecryptSignatureStatus, EncryptResult, SignerInfo } from './_types'
import { MajikFile } from '@majikah/majik-file'
import { useShepherd } from '@renderer/lib/shepherd-js/use-shepherd'
import { launchTutorialFileVault } from '@renderer/lib/shepherd-js/tutorials/tutorial-file-vault'

// ─── Local tokens ─────────────────────────────────────────────────────────────
const FONT_MONO = "'Fira Mono', 'JetBrains Mono', monospace"

// ─── Types ────────────────────────────────────────────────────────────────────
type EditorMode = 'encrypt' | 'decrypt'

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
  gap: 0;
  animation: ${fadeUp} 220ms cubic-bezier(0.4, 0, 0.2, 1) both;
`

// ─── Panel header (identical structure to MessagePanel) ───────────────────────
const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  margin-bottom: 16px;
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

const HeaderBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const LiveDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  opacity: 0.7;
  display: inline-block;
`

const BadgeLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.4;
  letter-spacing: 0.07em;
  text-transform: uppercase;
`

// ─── Description chip ─────────────────────────────────────────────────────────
const DescChip = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: ${({ theme }) => theme.colors.primarySoft};
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.65;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 16px;
`

const DescIcon = styled.span`
  font-size: 18px;
  flex-shrink: 0;
  opacity: 0.75;
`

// ─── Body ─────────────────────────────────────────────────────────────────────
const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
`

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 520px;
  margin: 32px auto 0;
  text-align: center;
`

// ─── Recipients section ────────────────────────────────────────────────────────
const RecipientsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`

const RecipientsLabel = styled.span`
  font-family: ${FONT_MONO};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.45;
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 50%;
  justify-content: flex-end;
`

/**
 * Mode badge — blue for encrypt (user selects recipients),
 * green for decrypt (recipients auto-detected from envelope).
 */
const ModeBadge = styled.span<{ $mode: EditorMode }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 100px;
  font-family: ${FONT_MONO};
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: all 200ms ease;

  ${({ $mode, theme }) =>
    $mode === 'encrypt'
      ? css`
          background: ${theme.colors.primarySoft};
          color: ${theme.colors.primary};
          border: 1px solid ${theme.colors.primarySoft};
        `
      : css`
          background: rgba(16, 185, 129, 0.1);
          color: ${theme.colors.brand.green};
          border: 1px solid rgba(16, 185, 129, 0.2);
        `}
`

// ─── My Files button ──────────────────────────────────────────────────────────

const MyFilesButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  font-family: ${FONT_MONO};
  font-size: 12px;
  font-weight: 500;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
    border-color: ${({ theme }) => theme.colors.secondaryBackground};
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.primaryBackground};
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.4;
    cursor: not-allowed;
  }
`

const DialogueBody = styled.div`
  /* Fill available height inside the sliding panel */
  display: flex;
  flex-direction: column;
  height: 100%;
  /* Remove the ModalContainer padding that DynamicSlidingDialogue adds */
  margin: -1rem -50px;
  padding: 0 28px;
  overflow: hidden;
`

// ─── Props ────────────────────────────────────────────────────────────────────
interface FilePanelProps {
  majik: MajikMessageDatabase
}

// ─── Component ────────────────────────────────────────────────────────────────
const FilePanel: React.FC<FilePanelProps> = ({ majik }) => {
  const { majikah } = useMajikah()
  const tour = useShepherd()
  const navigate = useNavigate()
  const location = useLocation()

  const [filesOpen, setFilesOpen] = useState(false)

  const [refreshKey, setRefreshKey] = useState<number>(0)
  const [inviteKey, setInviteKey] = useState<string>('')
  const [mode, setMode] = useState<EditorMode>('encrypt')

  // ── Own account (stable ref — doesn't change within a session) ─────────────
  const [myAccount] = useState<MajikContact | null>(() => majik.getActiveAccount())

  // ── Encrypt-mode: user-selected recipients (seeded with own account) ───────
  const [recipients, setRecipients] = useState<MajikContact[]>(() => {
    const active = majik.getActiveAccount()
    return active ? [active] : []
  })

  const [recipientsVersion, setRecipientsVersion] = useState(0)

  const [detectedContacts, setDetectedContacts] = useState<MajikContact[]>([])

  const [importedFile, setImportedFile] = useState<File | undefined>(undefined)

  // ── Unlock identity on mount ───────────────────────────────────────────────
  useEffect(() => {
    const unlockIdentity = async (): Promise<void> => {
      try {
        if (!majik) return
        const activeAccount = majik.getActiveAccount()
        if (!activeAccount) return
        await majik.ensureIdentityUnlocked(activeAccount.id)
        console.log('Access granted: Identity unlocked')
      } catch (err) {
        toast.error('Unlock failed', {
          description: `Incorrect passphrase. Please try again. ${err}`,
          id: 'toast-error-unlock'
        })
        console.warn('Failed to unlock identity:', err)
      }
    }
    unlockIdentity()
  }, [majik])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const path = (location?.state as any)?.mjkbPath
    if (!path) return

    const loadFile = async (): Promise<void> => {
      const response = await fetch(`file://${path}`)
      const blob = await response.blob()

      const file = new File([blob], path.split('/').pop() || 'file.mjkb')

      setImportedFile(file)
    }

    loadFile()
  }, [location.state])

  // ── Add contact ────────────────────────────────────────────────────────────
  const handleAddContact = async (): Promise<void> => {
    if (!majik) return
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
      toast.success('New Friend Added Successfully', {
        description: inviteKey,
        id: `toast-success-add-${inviteKey}`
      })
    } catch (e) {
      toast.error('Failed to Add New Contact', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (e as any)?.message || e,
        id: 'error-majik-add'
      })
    }
  }

  // ── Recipient list handlers (encrypt mode only) ────────────────────────────
  const handleRecipientsUpdate = (updated: MajikContact[]): void => {
    if (updated.length === 0) {
      setRecipients(myAccount ? [myAccount] : [])
    } else {
      setRecipients(updated)
    }
    setRecipientsVersion((v) => v + 1)
  }

  const handleRecipientsClear = (): void => {
    setRecipients(myAccount ? [myAccount] : [])
    setRecipientsVersion((v) => v + 1)
  }

  const handleModeChange = (next: EditorMode): void => {
    setMode(next)
    if (next === 'encrypt') {
      setDetectedContacts([])
    }
  }

  // ── Active signer info (for FileVault pre-encrypt display) ─────────────────
  // Computed once per render — reads only the memory-cached key, no async needed.
  const activeSignerInfo = useMemo((): SignerInfo | null => {
    const account = majik.getActiveAccount()
    if (!account) return null
    const key = MajikKeyStore.get(account.id)
    if (!key?.hasSigningKeys) return null
    return {
      signerId: key.fingerprint,
      signerLabel: account.meta?.label ?? undefined,
      isOwnAccount: true,
      isKnownContact: true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey])

  // ── Encrypt handler ────────────────────────────────────────────────────────

  const handleEncryptFile = async (
    file: File,
    mimeType: string,
    compressionLevel: CompressionLevel
  ): Promise<EncryptResult> => {
    const raw = await file.arrayBuffer()

    const recipientPubKeys = await Promise.all(
      recipients.map(async (r) => {
        const rBase64 = await r.getPublicKeyBase64()
        return rBase64
      })
    )

    try {
      const result = await majik.encryptFile({
        data: raw,
        context: 'user_upload',
        originalName: file.name,
        mimeType,
        recipients: recipientPubKeys,
        isTemporary: false,
        bypassSizeLimit: true,
        userId: majikah?.user?.id,
        compressionLevel
      })

      // Build signerInfo from the result — the signature field on metadata
      // is only populated when the account had signing keys.
      let signerInfo: SignerInfo | null = null
      if (result.metadata.signature) {
        try {
          const info = majik.getMajikFileSignerInfo(result.file)
          if (info) {
            signerInfo = {
              signerId: info.signerId,
              signerLabel: info.signerLabel ?? undefined,
              isOwnAccount: info.isOwnAccount,
              isKnownContact: info.isKnownContact
            }
          }
        } catch (e) {
          console.log('Signer Error: ', e)
          // getMajikFileSignerInfo failed — still return the result, just no signer info
        }
      }

      return {
        binary: result.binary,
        signedBinary: result.signedBinary,
        originalName: file.name,
        originalSize: file.size,
        encryptedSize: result.binary.size,
        hash: result.metadata.file_hash,
        signerInfo
      }
    } catch (e) {
      console.warn('Failed: ', e)
      throw e
    }
  }

  // ── Decrypt handler ─────────────────────────────────────────────────────────

  const handleDecryptFile = async (file: File): Promise<DecryptResult> => {
    const rawBytes = new Uint8Array(await file.arrayBuffer())

    // Check for an embedded MJKS trailer before decrypting
    const hasMjksTrailer = MajikFile.hasMjksTrailer(rawBytes)

    const { bytes, originalName, mimeType } = await majik.decryptFile({ source: file })

    let signatureStatus: DecryptSignatureStatus

    if (!hasMjksTrailer) {
      signatureStatus = { verdict: 'unsigned' }
    } else {
      try {
        const signerKey = MajikKeyStore.get(majik.getActiveAccount()!.id)

        if (signerKey?.hasSigningKeys) {
          const result = await MajikFile.verifySignedMJKB(rawBytes, signerKey)
          const allContacts = majik.listContacts(true)
          const contact = allContacts.find((c) => c.fingerprint === result.signerId)
          const isOwnAccount = majik
            .listOwnAccounts()
            .some((a) => a.fingerprint === result.signerId)

          signatureStatus = {
            verdict: result.valid ? 'valid' : 'invalid',
            signerId: result.signerId,
            signerLabel: contact?.meta?.label ?? undefined,
            isOwnAccount,
            isKnownContact: contact !== undefined,
            timestamp: result.timestamp,
            contentType: result.contentType
          }
        } else {
          // Trailer present but can't verify — extract metadata for display
          const embeddedSig = MajikFile.extractMjksSignature(rawBytes)
          signatureStatus = {
            verdict: 'unverified',
            signerId: embeddedSig?.signerId,
            timestamp: embeddedSig?.timestamp
          }
        }
      } catch {
        signatureStatus = { verdict: 'unverified' }
      }
    }

    return {
      binary: new Blob([bytes as BlobPart], { type: mimeType ?? 'application/octet-stream' }),
      originalName: originalName ?? file.name.replace(/\.mjkb$/i, ''),
      originalSize: bytes.byteLength,
      mimeType: mimeType ?? 'application/octet-stream',
      signatureStatus
    }
  }

  // ── Navigate to accounts ───────────────────────────────────────────────────
  const handleGoToAccounts = (): void => {
    navigate('/accounts')
  }

  // ── Contacts list for encrypt-mode selector ────────────────────────────────
  const contacts = useMemo(() => {
    if (!majik) return []
    return majik.listContacts(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [majik, refreshKey])

  const isDecryptMode = mode === 'decrypt'
  const selectorContacts = isDecryptMode ? [] : contacts
  const selectorValue = isDecryptMode ? detectedContacts : recipients

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageRoot>
      {/* ── Panel header ── */}
      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>File Vault</PanelTitle>
          <PanelSubtitle>Local Encrypt &amp; Decrypt · Works Offline · .mjkb format</PanelSubtitle>
          <HeaderBadge>
            <LiveDot />
            <BadgeLabel>Post-Quantum</BadgeLabel>
          </HeaderBadge>
        </HeaderLeft>

        <HeaderActions>
          <GuideHelper
            docsPath="https://majikah.solutions/products/majik-message/docs/file-vault"
            startTour={() => launchTutorialFileVault(tour)}
          />

          {/* My Files button — opens the sliding panel */}
          <MyFilesButton
            onClick={() => setFilesOpen(true)}
            disabled={!majikah.isAuthenticated}
            title={
              majikah.isAuthenticated
                ? 'View and manage your encrypted files.'
                : 'Login to access your files '
            }
          >
            <FolderOpenIcon size={14} />
            My Files
          </MyFilesButton>

          <PopUpFormButton
            id="button-popup-messages-add-contact"
            icon={UserPlusIcon}
            text="Add Contact"
            modal={{
              title: 'Add Friend',
              description: 'Add a new contact to your friend list.'
            }}
            buttons={{
              cancel: { text: 'Cancel' },
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
              importProp={{ type: 'txt' }}
              sensitive
            />
          </PopUpFormButton>
        </HeaderActions>
      </PanelHeader>

      {/* ── Description chip ── */}
      <DescChip>
        <DescIcon>
          <ShieldCheckIcon size={22} />
        </DescIcon>
        <span>
          Encrypt any file into a sealed <strong>.mjkb</strong> binary — protected with{' '}
          <strong>ML-KEM-768 + AES-256-GCM</strong>. Works fully offline. Drop in a{' '}
          <strong>.mjkb</strong> to decrypt it back to the original file. No size limit for local
          use.
        </span>
      </DescChip>

      {/* ── Empty state: no account ── */}
      {!myAccount ? (
        <EmptyWrap>
          <DynamicPlaceholder>
            Please create an account first to encrypt and decrypt files.
          </DynamicPlaceholder>
          <ChoiceButton $variant="primary" onClick={handleGoToAccounts}>
            Create or Import Account
          </ChoiceButton>
        </EmptyWrap>
      ) : (
        <Body>
          {/* ── Recipients section ── */}
          <div>
            <RecipientsHeader>
              <RecipientsLabel>Recipients</RecipientsLabel>
              <ModeBadge $mode={mode}>
                {mode === 'encrypt' ? 'Encrypt Mode' : 'Detected from message'}
              </ModeBadge>
            </RecipientsHeader>

            {/*
             * Encrypt mode: full interactive selector — user picks recipients.
             * Decrypt mode: disabled=true renders the selector in read-only state,
             *   showing detectedContacts as non-removable tags with no input field.
             *   `contacts` is passed as [] so no dropdown can open even if
             *   disabled is somehow bypassed.
             */}
            <MajikContactListSelector
              id="message-recipients"
              contacts={selectorContacts}
              value={selectorValue}
              onUpdate={isDecryptMode ? undefined : handleRecipientsUpdate}
              onClearAll={isDecryptMode ? undefined : handleRecipientsClear}
              allowEmpty={false}
              disabled={isDecryptMode}
            />
          </div>
          <FileVault
            onEncrypt={handleEncryptFile}
            onDecrypt={handleDecryptFile}
            onModeChange={handleModeChange}
            externalRefreshKey={recipientsVersion}
            decryptFile={importedFile}
            signerInfo={activeSignerInfo}
          />
        </Body>
      )}

      <DynamicSlidingDialogue
        isOpen={filesOpen}
        onOpenChange={setFilesOpen}
        modal={{
          title: 'My Files',
          description: 'Manage your encrypted MajikFile storage.'
        }}
        buttons={{
          cancel: { text: 'Close', hide: true },
          confirm: { text: 'Done', hide: true }
        }}
        scrollable={false}
        width={950}
      >
        <DialogueBody>
          <UserFiles
            majik={majik}
            uploadContext="user_upload"
            contacts={contacts}
            defaultRecipients={recipients}
          />
        </DialogueBody>
      </DynamicSlidingDialogue>
    </PageRoot>
  )
}

export default FilePanel
