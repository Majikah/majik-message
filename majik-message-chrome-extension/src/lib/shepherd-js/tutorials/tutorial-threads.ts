import type { Tour } from 'shepherd.js'
export function launchTutorialThreads(tour: Tour, completeTutorialFn?: () => void): void {
  const completeTutorial = (): void => {
    tour.complete()
    completeTutorialFn?.()
  }

  tour.addStep({
    id: 'majik-threads-welcome',
    title: 'Welcome to Threads',
    text: 'Threads lets you send secure messages that are stored long-term with other Majikah users.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-threads-requirements',
    title: 'Before You Start',
    text: 'To use Threads, you must register both a Majikah account and a Majik Key account online.',
    attachTo: { element: '#tab-majikah', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-threads-list',
    title: 'Your Threads',
    text: 'This panel shows all your ongoing threads.',
    attachTo: { element: '#section-threads', on: 'top' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-threads-preview',
    title: 'Private Preview',
    text: 'Hover over a thread to preview its latest message. For privacy, previews appear encrypted.',
    attachTo: { element: '#section-threads', on: 'top' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-threads-vs-chats',
    title: 'Threads vs Chats',
    text: 'Chats auto-delete after 24 hours. Threads stay stored until all participants agree to delete them.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-threads-encryption',
    title: 'Always Encrypted',
    text: 'All messages in Threads are sent and stored in encrypted form.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-threads-switch-account',
    title: 'Switch Active Account',
    text: 'Use this selector to choose which Majik Key account you are using.',
    attachTo: { element: '#selector-active-identity', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-threads-new-thread',
    title: 'Create a New Thread',
    text: 'Click here to start a new secure thread.',
    attachTo: { element: '#button-new-thread', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-thread-refresh',
    title: 'Refresh Threads',
    text: 'Click here to reload and check for new threads.',
    attachTo: { element: '#button-refresh-thread', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Finish Tour', action: completeTutorial }
    ]
  })

  tour.start()
}

export function launchTutorialThreadsMessages(tour: Tour, completeTutorialFn?: () => void): void {
  const completeTutorial = (): void => {
    tour.complete()
    completeTutorialFn?.()
  }

  tour.addStep({
    id: 'majik-thread-messages-welcome',
    title: 'Inside a Thread',
    text: 'This is where all messages in the thread are displayed.',
    attachTo: { element: '#section-thread-messages', on: 'top' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-thread-messages-permanent',
    title: 'Messages Cannot Be Edited or Deleted',
    text: 'Once a message is sent, it cannot be changed or removed.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-thread-messages-protected',
    title: 'Protected from Tampering',
    text: 'Each message is secured and verified to prevent tampering.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-thread-new-message',
    title: 'Send a New Message',
    text: 'Click here to add a message to this thread. Messages cannot be edited or deleted after sending.',
    attachTo: { element: '#button-new-thread-message', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-thread-rename',
    title: 'Rename This Thread',
    text: 'If you created this thread, you can change its subject here.',
    attachTo: { element: '#button-rename-thread', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-thread-refresh',
    title: 'Refresh Messages',
    text: 'Click here to reload and check for new messages.',
    attachTo: { element: '#button-refresh-thread-messages', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-thread-close',
    title: 'Mark Thread as Closed',
    text: 'The owner can mark the thread as closed. Once closed, no new messages can be added, but it will remain visible. Closing is optional and allows the owner to later delete the thread automatically without requiring other participants’ approval.',
    attachTo: { element: '#button-close-thread', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-thread-delete',
    title: 'Delete This Thread',
    text: 'Any participant can request to delete the thread. The owner can also choose to toggle the automatic delete option after closing the thread to remove it immediately without approval. Once deleted, all participants receive a download link to the full encrypted message history. The link expires after 72 hours.',
    attachTo: { element: '#button-delete-thread-form', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Finish Tour', action: completeTutorial }
    ]
  })

  tour.start()
}
