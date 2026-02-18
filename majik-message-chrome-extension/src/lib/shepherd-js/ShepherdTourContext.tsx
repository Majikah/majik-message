// ShepherdTourContext.tsx
import React from 'react'
import Shepherd, { type Tour } from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'
import { ShepherdFactoryContext } from './shepherd-context'

export const ShepherdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const createTour = (): Tour =>
    new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'custom-tour-step',
        scrollTo: true,
        cancelIcon: { enabled: true }
      }
    })

  return (
    <ShepherdFactoryContext.Provider value={createTour}>{children}</ShepherdFactoryContext.Provider>
  )
}
