import { type ColumnDef } from '@tanstack/react-table'

import { MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'

import styled from 'styled-components'
import { MajikMessageIdentity } from '@majikah/majik-message'
import { parseDateFromISO } from '@renderer/utils/utils'

const PublicKeyCell = styled.div`
  flex: 1;

  text-align: left;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1; /* Limit to 5 lines */
  -webkit-box-orient: vertical;
  white-space: normal;
  word-break: break-word;
`

const ItemTitleClick = styled.div`
  flex: 1;
  min-width: 150px;
  max-width: 200px;
  text-align: left;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  white-space: normal;
  word-break: break-word;
  cursor: pointer;
  transition: all 0.1s ease;

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      font-weight: 600;
    }
  }
`

export const columnsAccountIdentities = (
  fnView?: (data: MajikMessageIdentity) => void,
  fnEdit?: (data: MajikMessageIdentity) => void,
  fnDelete?: (data: MajikMessageIdentity) => void
): ColumnDef<MajikMessageIdentity>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <div className="flex justify-center items-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="data-[state=checked]:bg-[#ea7f05] data-[state=checked]:border-[#514f4f]data-[state=checked]:text-[#ea7f05] border-[#ea7f05]"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex justify-center items-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="data-[state=checked]:bg-[#ea7f05] data-[state=checked]:border-[#514f4f]data-[state=checked]:text-[#ea7f05] border-[#514f4f]"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false
  },

  {
    accessorKey: 'label',
    header: () => <div className="text-left">Name</div>,
    cell: ({ row }) => (
      <ItemTitleClick onClick={() => fnView?.(row.original)} data-private>
        {row.original.label}
      </ItemTitleClick>
    )
  },

  {
    accessorKey: 'metadata.general.description',
    header: () => <div className="text-left">Public Key</div>,
    cell: ({ row }) => (
      <PublicKeyCell data-private>{row.original.publicKey || 'Not Available'}</PublicKeyCell>
    )
  },

  {
    accessorKey: 'progress_status',
    header: () => <div className="text-center">Status</div>,
    cell: ({ row }) => (
      <div className="text-center">{row.original.restricted ? 'Restricted' : 'Active'}</div>
    )
  },

  {
    accessorKey: 'timestamp',
    header: () => <div className="text-center">Created At</div>,
    cell: ({ row }) => {
      const isoDate: string = row.getValue('timestamp')
      const formatted = parseDateFromISO(isoDate, true)

      return <div className="text-center">{formatted}</div>
    }
  },

  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const propData = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="!p-2 !space-y-1 !bg-[#f2e0cb] !border-[#f2e0cb]"
          >
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {!!fnView && (
              <DropdownMenuItem onClick={() => fnView(propData)} className="!px-1">
                View
              </DropdownMenuItem>
            )}
            {!!fnEdit && (
              <DropdownMenuItem onClick={() => fnEdit(propData)} className="!px-1">
                Edit
              </DropdownMenuItem>
            )}

            {!!fnDelete && (
              <DropdownMenuItem onClick={() => fnDelete(propData)} className="!px-1">
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  }
]
