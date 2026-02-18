import type { Tour } from 'shepherd.js'

export function launchTutorialContacts(tour: Tour, completeTutorialFn?: () => void): void {
  const completeTutorial = (): void => {
    tour.complete()
    completeTutorialFn?.()
  }

  tour.addStep({
    id: 'majik-message-contacts-welcome',
    title: 'Welcome to Contacts!',
    text: 'Your Contacts list stores trusted accounts. You must add someone here before you can encrypt messages to them or decrypt messages from them.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-contacts-overview',
    title: 'Contacts Overview',
    text: 'This panel shows all saved contacts. Each contact represents a trusted public key you can securely message.',
    attachTo: { element: '#section-contacts', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-contacts-add',
    title: 'Add a Contact',
    text: 'Click here to add someone using their invite key.',
    attachTo: { element: '#button-popup-contacts-add', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-contacts-invite-key',
    title: 'Get Their Invite Key',
    text: 'Ask your friend to open their Accounts panel and share their invite key with you. Paste it here to add them as a contact.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-contacts-actions',
    title: 'Manage Contacts',
    text: 'Hover over a contact to rename or remove them from your list.',
    attachTo: { element: '#section-contacts', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Finish Tour', action: completeTutorial }
    ]
  })
  tour.start()
}
