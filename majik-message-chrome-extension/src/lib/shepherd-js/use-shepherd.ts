// useShepherd.ts
import { useContext } from 'react'
import { ShepherdFactoryContext } from './shepherd-context'
import React from 'react'
import type { Tour } from 'shepherd.js'

/**
 * Returns a new Shepherd.Tour instance per component (memoized so it sticks
 * for the lifetime of that component instance).
 */
export const useShepherd = (): Tour => {
  const create = useContext(ShepherdFactoryContext)
  if (!create) throw new Error('useNewShepherdTour must be used within ShepherdProvider')
  // each consumer gets its own tour instance
  return React.useMemo(() => create(), [create])
}
