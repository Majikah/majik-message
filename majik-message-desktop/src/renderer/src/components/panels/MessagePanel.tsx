import styled, { css, keyframes } from 'styled-components'
import { useEffect, useMemo, useState } from 'react'
import PopUpFormButton from '../foundations/PopUpFormButton'
import { LockKeyIcon, UserPlusIcon } from '@phosphor-icons/react'
import CustomInputField from '../foundations/CustomInputField'
import { MajikContact, MessageEnvelope } from '@majikah/majik-message'

import { toast } from 'sonner'

import TextEditPreviewInput from '../functional/TextEditPreviewInput'

import { MajikContactListSelector } from '../MajikContactListSelector'
import type { MajikMessageDatabase } from '../majik-context-wrapper/majik-message-database'
import DynamicPlaceholder from '../foundations/DynamicPlaceholder'

import { ChoiceButton } from '@renderer/globals/buttons'
import { useNavigate } from 'react-router-dom'
import GuideHelper from '../functional/GuideHelper'
import { launchTutorialMessages } from '@renderer/lib/shepherd-js/tutorials/tutorial-messages'
import { useShepherd } from '@renderer/lib/shepherd-js/use-shepherd'

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

// ─── Panel header (matches all other redesigned panels) ───────────────────────
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

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 50%;
`

// ─── Description chip ─────────────────────────────────────────────────────────
/**
 * Replaces the 3-sentence paragraph. Key facts only:
 *   encrypt for any contact · works offline · live convo → Chats
 */
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
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
  opacity: 0.7;
`

// ─── Main body ────────────────────────────────────────────────────────────────
const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
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

// ─── Props ────────────────────────────────────────────────────────────────────
interface MessagePanelProps {
  majik: MajikMessageDatabase
}

// ─── Component ────────────────────────────────────────────────────────────────
const MessagePanel: React.FC<MessagePanelProps> = ({ majik }) => {
  const navigate = useNavigate()
  const tour = useShepherd()

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

  // ── Decrypt-mode: contacts extracted from the envelope ────────────────────
  /**
   * Populated by `handleDecryptMessage` after a successful decryption.
   * Cleared whenever the mode switches back to "encrypt" or input is cleared.
   *
   * Extraction strategy:
   *   - Parse the raw envelope string with `MessageEnvelope.fromMatchedString`
   *   - Solo message (isSolo): one fingerprint via `extractFingerprint()`
   *   - Group message (isGroup): many fingerprints from `payload.keys[].fingerprint`
   *   - Resolve fingerprints → MajikContact via `majik.listContacts(true)`
   *     (true = include own accounts so self-addressed messages also resolve)
   */
  const [detectedContacts, setDetectedContacts] = useState<MajikContact[]>([])

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
  }

  const handleRecipientsClear = (): void => {
    setRecipients(myAccount ? [myAccount] : [])
  }

  // ── Mode change callback from TextEditPreviewInput ────────────────────────
  /**
   * Called when the user clicks Encrypt/Decrypt pill in TextEditPreviewInput.
   * Clears detected contacts when returning to encrypt mode.
   */
  const handleModeChange = (next: EditorMode): void => {
    setMode(next)
    if (next === 'encrypt') {
      setDetectedContacts([])
    }
  }

  // ── Encrypt ────────────────────────────────────────────────────────────────
  const handleEncryptMessage = async (input: string): Promise<string> => {
    if (!input?.trim()) return ''
    if (!myAccount) return 'No active account found.'
    if (!recipients || recipients.length === 0) return 'No recipients selected.'

    const recipientIds = recipients.map((c) => c.id)
    const encrypted = await majik.encryptTextForScanner(input, recipientIds, false)
    return encrypted ?? ''
  }

  // ── Decrypt + extract recipients from envelope ─────────────────────────────
  /**
   * After decryption, we parse the same input string as a MessageEnvelope
   * to extract which fingerprints were addressed, then resolve them to
   * MajikContact objects so the selector can display them in read-only mode.
   *
   * Envelope anatomy:
   *   Solo:  [version 1 byte][fingerprint 32 bytes][encrypted payload JSON]
   *          → extractFingerprint() → one fingerprint
   *   Group: [version 1 byte][marker 32 bytes][payload JSON with keys[].fingerprint]
   *          → extractEncryptedPayload().keys[].fingerprint → N fingerprints
   *
   * Fingerprint resolution:
   *   majik.listContacts(true) includes own accounts (true = all contacts).
   *   Match contact.fingerprint === envelopeFingerprint.
   */
  const handleDecryptMessage = async (input: string): Promise<string> => {
    if (!input?.trim()) {
      setDetectedContacts([])
      return ''
    }
    if (!myAccount) return 'No active account found.'

    // Step 1: Decrypt
    const envelope = MessageEnvelope.fromMatchedString(input)
    const decrypted = await majik.decryptEnvelope(envelope, true)

    // Step 2: Extract fingerprints from the same envelope
    try {
      const allContacts = majik.listContacts(true) // includes own accounts
      const fingerprintMap = new Map(allContacts.map((c) => [c.fingerprint, c]))

      let resolved: MajikContact[] = []

      if (envelope.isSolo()) {
        // Single fingerprint at bytes [1..32]
        const fp = envelope.extractFingerprint()
        const contact = fingerprintMap.get(fp)
        if (contact) resolved = [contact]
      } else {
        // Group: read keys[].fingerprint from the payload
        const payload = envelope.extractEncryptedPayload() as {
          keys: Array<{ fingerprint: string }>
        }
        resolved = (payload.keys ?? [])
          .map((k) => fingerprintMap.get(k.fingerprint))
          .filter((c): c is MajikContact => !!c)
      }

      setDetectedContacts(resolved)
    } catch (err) {
      // Non-fatal — decryption succeeded, recipient display is best-effort
      console.warn('Could not resolve envelope recipients:', err)
      setDetectedContacts([])
    }

    return decrypted
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

  // ── Derived: which contacts + which mode to show in the selector ───────────
  /**
   * In decrypt mode:
   *   - `selectorContacts` = empty (no dropdown needed)
   *   - `selectorValue`    = detectedContacts (read-only display)
   *   - `disabled`         = true
   *
   * In encrypt mode:
   *   - `selectorContacts` = full contact list (for dropdown)
   *   - `selectorValue`    = user-selected recipients
   *   - `disabled`         = false
   */
  const isDecryptMode = mode === 'decrypt'
  const selectorContacts = isDecryptMode ? [] : contacts
  const selectorValue = isDecryptMode ? detectedContacts : recipients

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageRoot>
      {/* ── Panel header ── */}
      <PanelHeader>
        <HeaderLeft>
          <PanelTitle>Message</PanelTitle>
          <PanelSubtitle>Local Encrypt &amp; Decrypt · Works Offline</PanelSubtitle>
        </HeaderLeft>

        <HeaderActions>
          <GuideHelper
            docsPath="https://majikah.solutions/products/majik-message/docs/message-local-documentation"
            startTour={() => launchTutorialMessages(tour)}
          />

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
            />
          </PopUpFormButton>
        </HeaderActions>
      </PanelHeader>

      {/* ── Description chip ── */}
      <DescChip>
        <DescIcon>
          <LockKeyIcon size={24} />
        </DescIcon>
        <span>
          Encrypt messages for any contact — even without Majikah registration. Works fully offline.
          For live conversations, use the <strong>Chats</strong> window.
        </span>
      </DescChip>

      {/* ── Empty state: no account ── */}
      {!myAccount ? (
        <EmptyWrap>
          <DynamicPlaceholder>
            Please create an account first to start encrypting and decrypting messages.
          </DynamicPlaceholder>
          <ChoiceButton $variant="primary" onClick={handleGoToAccounts}>
            Create or Import Account
          </ChoiceButton>
        </EmptyWrap>
      ) : (
        <Body id="section-messages">
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

          {/* ── TextEditPreviewInput ── */}
          <TextEditPreviewInput
            onEncrypt={handleEncryptMessage}
            onDecrypt={handleDecryptMessage}
            onModeChange={handleModeChange}
            downloadName={`Message from ${myAccount?.meta?.label || myAccount?.id}`}
          />
        </Body>
      )}
    </PageRoot>
  )
}

export default MessagePanel
