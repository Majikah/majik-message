import { type Icon } from '@phosphor-icons/react'
import React, { type JSX } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import styled, { css } from 'styled-components'

export interface RouterTabContent {
  id: string
  name: string
  element: React.ReactElement
  route: string
  icon?: Icon // supports Phosphor, Heroicons, etc.
  notification?: React.ReactElement
}

interface TabRouterProps {
  tabs: RouterTabContent[]
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
  width: 100%;
  cursor: pointer;
  padding: 0.75rem 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-weight: 500;
  font-size: 14px;
  justify-content: center;
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

  @media (max-width: 1250px) {
    padding: 15px 10px;
    gap: 0px;
    width: 100%;
    flex-direction: column;
  }
`

const NotifContainer = styled.div`
  position: absolute;
  top: -4px;
  right: -4px;
  width: 10px;
  height: 10px;

  border-radius: 50%;
`

const ContentWrapper = styled.div`
  flex: 1;
  padding: 1rem;
  overflow: auto;
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

const TabNameText = styled.p<{ $active?: boolean }>`
  @media (max-width: 500px) {
    display: none;
  }
`

const IconContainer = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  position: relative;
  svg {
    color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textPrimary)};
  }
`

export const TabRouter: React.FC<TabRouterProps> = ({ tabs, position = 'top' }): JSX.Element => {
  const navigate = useNavigate()
  const location = useLocation()

  const activeTab = tabs.find((tab) => location.pathname.endsWith(tab.route)) ?? tabs[0]

  const renderTabs = (): JSX.Element[] =>
    tabs.map((tab) => {
      const isActive = tab.id === activeTab.id

      return (
        <TabButton
          key={tab.id}
          $active={isActive}
          onClick={() => navigate(tab.route)}
          id={`tab-${tab.id}`}
        >
          {tab.icon && (
            <IconContainer $active={isActive}>
              <tab.icon size={24} />
              {tab.notification && <NotifContainer>{tab.notification}</NotifContainer>}
            </IconContainer>
          )}
          <TabNameText $active={isActive}>{tab.name}</TabNameText>
        </TabButton>
      )
    })

  return (
    <RootContainer>
      <TabContainer position={position}>
        {(position === 'top' || position === 'left') && (
          <>
            <TabList position={position}>{renderTabs()}</TabList>
            <ContentWrapper>
              <Routes>
                {tabs.map((tab) => (
                  <Route key={tab.id} path={tab.route} element={tab.element} />
                ))}
                {/* default */}
                <Route path="*" element={tabs[0].element} />
              </Routes>
            </ContentWrapper>
          </>
        )}

        {(position === 'bottom' || position === 'right') && (
          <>
            <ContentWrapper>
              <Routes>
                {tabs.map((tab) => (
                  <Route key={tab.id} path={tab.route} element={tab.element} />
                ))}
              </Routes>
            </ContentWrapper>
            <TabList position={position}>{renderTabs()}</TabList>
          </>
        )}
      </TabContainer>
    </RootContainer>
  )
}
