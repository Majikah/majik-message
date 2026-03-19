import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import styled from "styled-components";
import { Button } from "@/components/ui/button";
import DynamicPlaceholder from "@/components/foundations/DynamicPlaceholder";
import type { JSX } from "react";

/* ---------- layout ----------- */
const TablePadding = styled.div`
  display: flex;
`;

const PageText = styled.p`
  ${({ theme }) => theme.colors.textSecondary};
  font-size: 14px;
  opacity: 0.8;
`;

/* ---------- props ----------- */
interface WindowDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  currentPage?: number;
  disablePagePrevious?: boolean;
  disablePageNext?: boolean;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  onEmptyActionClick?(): void;
  onEmptyActionButtonText?: string;
  onEmptyText?: string;
  showPagination?: boolean;
}

/* ---------- component ----------- */
export function WindowDataTable<TData, TValue>({
  columns,
  data,
  currentPage = 0,
  disablePagePrevious = true,
  disablePageNext = true,
  onPageChange,
  loading = false,
  onEmptyActionClick,
  onEmptyActionButtonText = "Create New Item",
  onEmptyText = "There are currently no items available.",
  showPagination = true,
}: WindowDataTableProps<TData, TValue>): JSX.Element {
  /* table core */

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  /* pagination handlers */
  const handlePageChange = (newPageIndex: number): void => {
    onPageChange?.(newPageIndex);
  };
  const handlePagePrevious = (): void => {
    handlePageChange(Math.max(currentPage - 1, 0));
  };
  const handlePageNext = (): void => {
    handlePageChange(currentPage + 1);
  };

  /* ---------- render ----------- */
  return (
    <div className="w-full rounded-md border ">
      {/* pagination controls */}
      {showPagination && (
        <div className="flex items-center justify-end gap-4 p-3 !m-5">
          <PageText>Page {currentPage + 1}</PageText>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePagePrevious}
            disabled={disablePagePrevious}
            className="w-24"
          >
            Previous
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePageNext}
            disabled={disablePageNext}
            className="w-24"
          >
            Next
          </Button>
        </div>
      )}

      {/* data table */}
      <TablePadding>
        <Table>
          {/* ---------- header ---------- */}
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="hover:bg-[#f8eee2] transition-colors"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="!px-2 text-center text-[#ea7f05]"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          {/* ---------- body ---------- */}
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="h-20 hover:bg-[#ea7f05]  transition-colors group"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="!px-2 text-center text-[#272525] group-hover:text-[#f8eee2]"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="h-24">
                <TableCell
                  className="text-center text-[#514f4f]"
                  colSpan={columns.length}
                >
                  {loading ? (
                    <DynamicPlaceholder loading={loading}>
                      Loading data...
                    </DynamicPlaceholder>
                  ) : (
                    <DynamicPlaceholder
                      onActionClick={onEmptyActionClick}
                      actionButtonText={onEmptyActionButtonText}
                    >
                      {onEmptyText || "There are currently no items available."}
                    </DynamicPlaceholder>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TablePadding>
    </div>
  );
}

export default WindowDataTable;
