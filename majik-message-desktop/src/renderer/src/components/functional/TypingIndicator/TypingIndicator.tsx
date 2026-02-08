import styled, { keyframes } from 'styled-components'
import type { MajikMessagePublicKey } from '@majikah/majik-message'
import { useEffect, useState } from 'react'
import type { MajikMessageDatabase } from '@renderer/components/majik-context-wrapper/majik-message-database'

const bounce = keyframes`
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-4px);
  }
`

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  min-height: 32px;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;
`

const DotsContainer = styled.div`
  display: flex;
  gap: 4px;
  margin-left: 4px;
`

const Dot = styled.span<{ delay: number }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  animation: ${bounce} 1.4s infinite ease-in-out;
  animation-delay: ${({ delay }) => delay}s;
`

interface TypingIndicatorProps {
  typingPublicKeys: MajikMessagePublicKey[]
  majik: MajikMessageDatabase
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ typingPublicKeys, majik }) => {
  const [displayNames, setDisplayNames] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    const fetchNames = async (): Promise<void> => {
      const names = await Promise.all(
        typingPublicKeys.map(async (publicKey) => {
          try {
            const contact = await majik.getContactByPublicKey(publicKey)
            return (await contact?.getDisplayName()) || 'Unknown User'
          } catch {
            return 'Unknown User'
          }
        })
      )

      if (!cancelled) {
        setDisplayNames(names)
      }
    }

    fetchNames()

    return () => {
      cancelled = true
    }
  }, [typingPublicKeys, majik])

  if (typingPublicKeys.length === 0) return null

  const formatTypingText = (): string => {
    if (displayNames.length === 0) return ''

    if (displayNames.length === 1) {
      return `${displayNames[0]} is typing`
    }

    if (displayNames.length === 2) {
      return `${displayNames[0]} and ${displayNames[1]} are typing`
    }

    if (displayNames.length === 3) {
      return `${displayNames[0]}, ${displayNames[1]}, and ${displayNames[2]} are typing`
    }

    return `${displayNames.length} people are typing`
  }

  return (
    <Container>
      <span>{formatTypingText()}</span>
      <DotsContainer>
        <Dot delay={0} />
        <Dot delay={0.2} />
        <Dot delay={0.4} />
      </DotsContainer>
    </Container>
  )
}
