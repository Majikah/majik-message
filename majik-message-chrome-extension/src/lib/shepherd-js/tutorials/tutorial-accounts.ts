import type { Tour } from 'shepherd.js'

export function launchTutorialAccounts(tour: Tour, completeTutorialFn?: () => void): void {
  const completeTutorial = (): void => {
    tour.complete()
    completeTutorialFn?.()
  }

  tour.addStep({
    id: 'majik-message-accounts-welcome',
    title: 'Welcome to Majik Message Accounts!',
    text: 'Manage all your local Majik key accounts here. You can create, import, and organize your accounts securely.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-accounts-overview',
    title: 'Accounts Panel Overview',
    text: 'Here you see all your accounts at a glance. You can add, rename, export, or register accounts online.',
    attachTo: { element: '#section-accounts', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-accounts-create',
    title: 'Create a New Account',
    text: 'Click to create a new account with a generated seed phrase. Set a password and a backup JSON will be downloaded automatically.',
    attachTo: { element: '#button-popup-accounts-create', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-accounts-import',
    title: 'Import an Account',
    text: 'Click to import an existing account from a backup JSON file.',
    attachTo: { element: '#button-popup-accounts-import', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-accounts-actions',
    title: 'Manage Your Accounts',
    text: 'Hover over an account to see more options: rename, register online, share your invite key, or view the public key.',
    attachTo: { element: '#section-accounts', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Finish Tour', action: completeTutorial }
    ]
  })

  tour.start()
}
