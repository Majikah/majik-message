import * as React from 'react'
import * as TogglePrimitive from '@radix-ui/react-toggle'

import { cn } from '../../lib/utils'

import { toggleVariants, type ToggleVariants } from './toggle-variants'
import type { JSX } from 'react'

interface ToggleProps extends React.ComponentProps<typeof TogglePrimitive.Root>, ToggleVariants {}

export function Toggle({ className, variant, size, ...props }: ToggleProps): JSX.Element {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}
