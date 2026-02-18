import type { Tour } from 'shepherd.js'
export function launchTutorialChats(tour: Tour, completeTutorialFn?: () => void): void {
  const completeTutorial = (): void => {
    tour.complete()
    completeTutorialFn?.()
  }

  tour.addStep({
    id: 'majik-message-chats-welcome',
    title: 'Welcome to Chats',
    text: 'Chats lets you message other Majikah users in real time using secure encryption.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-chats-requirements',
    title: 'Before You Start',
    text: 'To use Chats, you must register both a Majikah account and a Majik Key account online.',
    attachTo: { element: '#tab-majikah', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-chats-conversations',
    title: 'Your Conversations',
    text: 'This panel shows all your active conversations.',
    attachTo: { element: '#section-chats', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-chats-expiry',
    title: 'Messages Auto-Delete',
    text: 'Messages are stored for 24 hours only. After that, they are automatically deleted.',
    attachTo: { element: '#section-chats-messages', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-chats-encryption',
    title: 'Always Encrypted',
    text: 'All messages sent through Chats are encrypted automatically.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-chats-switch-account',
    title: 'Switch Active Account',
    text: 'Use this selector to change which Majik Key account you are chatting with.',
    attachTo: { element: '#selector-active-identity', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-chats-new-convo',
    title: 'Start a New Conversation',
    text: 'Click here to create a new conversation with a contact.',
    attachTo: { element: '#button-new-conversation', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Finish Tour', action: completeTutorial }
    ]
  })

  tour.start()
}
