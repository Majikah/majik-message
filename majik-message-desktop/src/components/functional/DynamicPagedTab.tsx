import { type Icon } from '@phosphor-icons/react'
import React, { useState, type JSX } from 'react'
import styled, { css } from 'styled-components'

export interface TabContent {
  id: string
  name: string
  content: React.ReactElement
  icon?: Icon // supports Phosphor, Heroicons, etc.
}

interface DynamicPagedTabProps {
  tabs: TabContent[]
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const RootContainer = styled.div`
  width: inherit;
  height: inherit;
`

const TabContainer = styled.div<{ position: string }>`
  display: flex;
  flex-direction: ${({ position }) =>
    position === 'left' || position === 'right' ? 'row' : 'column'};
  width: 100vw;
  height: 100%;
  border: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 12px;
  overflow: hidden;
`

const TabList = styled.div<{ position: string }>`
  ${({ position }) => {
    switch (position) {
      case 'left':
        return css`
          flex-direction: column;
          border-right: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
        `
      case 'right':
        return css`
          flex-direction: column;
          border-left: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
        `
      case 'bottom':
        return css`
          flex-direction: row;
          border-top: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
        `
      case 'top':
      default:
        return css`
          flex-direction: row;
          border-bottom: 1px solid ${({ theme }) => theme.colors.secondaryBackground};
        `
    }
  }}
  display: flex;
  background-color: ${({ theme }) => theme.colors.secondaryBackground};
`

const TabButton = styled.button<{ $active: boolean }>`
  all: unset;
  cursor: pointer;
  padding: 0.75rem 3rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-weight: 500;
  font-size: 14px;
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
  background-color: ${({ $active, theme }) =>
    $active ? theme.colors.primaryBackground : 'transparent'};
  border-bottom: ${({ $active, theme }) =>
    $active ? `2px solid ${theme.colors.primary}` : '2px solid transparent'};
  transition: background 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primaryBackground};

    svg {
      color: ${({ theme }) => theme.colors.primaryBackground};
    }
  }

  @media (max-width: 728px) {
    padding: 15px 10px;
    gap: 0px;
    width: 100%;
    flex-direction: column;
  }
`

const ContentWrapper = styled.div`
  flex: 1;
  padding: 1rem;
`

const TabNameText = styled.p<{ $active?: boolean }>``

const IconContainer = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;

  svg {
    color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textPrimary)};
  }
`

export const DynamicPagedTab: React.FC<DynamicPagedTabProps> = ({ tabs, position = 'top' }) => {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id)

  const $activeTab = tabs.find((tab) => tab.id === activeTabId)

  const renderTabs = (): JSX.Element[] =>
    tabs.map((tab) => (
      <TabButton
        key={`tab-${tab.id}`}
        $active={tab.id === activeTabId}
        onClick={() => setActiveTabId(tab.id)}
      >
        {tab.icon && (
          <IconContainer $active={tab.id === activeTabId}>
            <tab.icon size={24} weight="regular" />
          </IconContainer>
        )}
        <TabNameText $active={tab.id === activeTabId}>{tab.name}</TabNameText>
      </TabButton>
    ))

  return (
    <RootContainer>
      <TabContainer position={position}>
        {(position === 'top' || position === 'left') && (
          <>
            <TabList position={position}>{renderTabs()}</TabList>
            <ContentWrapper id={`tab-content-${$activeTab?.id || 'default'}`}>
              {$activeTab?.content}
            </ContentWrapper>
          </>
        )}
        {(position === 'bottom' || position === 'right') && (
          <>
            <ContentWrapper id={`tab-content-${$activeTab?.id || 'default'}`}>
              {$activeTab?.content}
            </ContentWrapper>
            <TabList position={position}>{renderTabs()}</TabList>
          </>
        )}
      </TabContainer>
    </RootContainer>
  )
}

export default DynamicPagedTab
