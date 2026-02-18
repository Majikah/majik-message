import type { Tour } from 'shepherd.js'
export function launchTutorialMessages(tour: Tour, completeTutorialFn?: () => void): void {
  const completeTutorial = (): void => {
    tour.complete()
    completeTutorialFn?.()
  }

  tour.addStep({
    id: 'majik-message-local-welcome',
    title: 'Welcome to Local Message',
    text: 'This tool lets you encrypt and decrypt messages manually. You can use it online or offline.',
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-local-purpose',
    title: 'How This Is Different from Chats',
    text: 'Chats is for live conversations. Local Message is for preparing or opening encrypted text from any source — even outside Majikah.',
    attachTo: { element: '#section-messages', on: 'top' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-mode-toggle',
    title: 'Encrypt or Decrypt',
    text: 'Use this button to switch between Encrypt mode and Decrypt mode.',
    attachTo: { element: '#button-toggle-mode', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-recipients',
    title: 'Select Recipients (Encrypt Mode)',
    text: 'When encrypting, choose who can read your message. Only contacts saved in your directory will appear here.',
    attachTo: { element: '#message-recipients', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-add-contact',
    title: 'Quick Add Contact',
    text: 'Need to add someone? Use this button to quickly add a new contact.',
    attachTo: { element: '#button-popup-messages-add-contact', on: 'bottom' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-input-panel',
    title: 'Enter Your Message',
    text: 'Type your original message here when encrypting. Or paste an encrypted message here when decrypting.',
    attachTo: { element: '#panel-input-text', on: 'right' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-output-panel',
    title: 'View the Result',
    text: 'This panel shows the final result. It updates automatically as you type.',
    attachTo: { element: '#panel-output-text', on: 'left' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-input-actions',
    title: 'Input Shortcuts',
    text: 'Use these buttons to paste text, or import a .txt or .json file into the input box.',
    attachTo: { element: '#panel-input-actions', on: 'top' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Next', action: tour.next }
    ]
  })

  tour.addStep({
    id: 'majik-message-output-actions',
    title: 'Save or Copy the Result',
    text: 'You can copy the result, or download it as a .txt or .json file.',
    attachTo: { element: '#panel-output-actions', on: 'top' },
    buttons: [
      { text: 'End Tour', action: completeTutorial, secondary: true },
      { text: 'Back', action: tour.back },
      { text: 'Finish Tour', action: completeTutorial }
    ]
  })

  tour.start()
}
