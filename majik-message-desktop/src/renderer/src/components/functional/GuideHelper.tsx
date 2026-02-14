import React from 'react'
import styled from 'styled-components'
import StyledIconButton from '../foundations/StyledIconButton'
import { BookOpenTextIcon, QuestionIcon } from '@phosphor-icons/react'

const RootContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  width: 100%;
  justify-content: flex-end;

  @media (max-width: 768px) {
  }
`

type GuideHelperProps = {
  docsPath?: string
  startTour?: () => void
  id?: string
}

const GuideHelper: React.FC<GuideHelperProps> = ({ docsPath, startTour, id }) => {
  const handleReadDocs = (): void => {
    if (!docsPath || docsPath.trim() === '') return

    const url =
      docsPath.startsWith('http://') || docsPath.startsWith('https://') ? docsPath : `/${docsPath}`

    window.open(url, '_blank')
  }

  return (
    <RootContainer>
      {!!startTour && startTour !== undefined ? (
        <StyledIconButton
          icon={BookOpenTextIcon}
          size={20}
          onClick={startTour}
          tooltip="Start Tutorial"
          disabled={!startTour}
          id={id}
        />
      ) : null}

      {!!docsPath && docsPath.trim() !== '' ? (
        <StyledIconButton
          icon={QuestionIcon}
          size={20}
          onClick={handleReadDocs}
          tooltip="Read Docs"
          disabled={!docsPath}
          id={id}
        />
      ) : null}
    </RootContainer>
  )
}

export default GuideHelper
