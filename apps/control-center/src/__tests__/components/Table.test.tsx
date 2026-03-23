/**
 * ART – Table component tests
 *
 * Covers:
 *  - Renders column headers
 *  - Renders data rows
 *  - Empty state message
 *  - Loading state
 *  - Sort indicator rendering and click handler
 *  - Pagination controls (page info, prev/next buttons, disabled states)
 *  - Custom render functions in columns
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Table, { Column } from '@/components/ui/Table';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ChevronUp: (props: Record<string, unknown>) => <svg data-testid="chevron-up" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
  ChevronLeft: (props: Record<string, unknown>) => <svg data-testid="chevron-left" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <svg data-testid="chevron-right" {...props} />,
}));

type TestRow = { id: string; name: string; age: number } & Record<string, unknown>;

const columns: Column<TestRow>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'age', header: 'Age', sortable: true },
];

const sampleData: TestRow[] = [
  { id: '1', name: 'Alice', age: 30 },
  { id: '2', name: 'Bob', age: 25 },
  { id: '3', name: 'Charlie', age: 35 },
];

const keyExtractor = (row: TestRow) => row.id;

describe('Table', () => {
  // ── Header rendering ──────────────────────────────────────────

  it('renders all column headers', () => {
    render(<Table columns={columns} data={sampleData} keyExtractor={keyExtractor} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  // ── Data rows ─────────────────────────────────────────────────

  it('renders all data rows', () => {
    render(<Table columns={columns} data={sampleData} keyExtractor={keyExtractor} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders cell values from row keys', () => {
    render(<Table columns={columns} data={sampleData} keyExtractor={keyExtractor} />);
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
  });

  // ── Custom render ─────────────────────────────────────────────

  it('uses custom render function when provided', () => {
    const customColumns: Column<TestRow>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (row) => <strong data-testid={`bold-${row.id}`}>{row.name.toUpperCase()}</strong>,
      },
    ];
    render(<Table columns={customColumns} data={sampleData} keyExtractor={keyExtractor} />);
    expect(screen.getByText('ALICE')).toBeInTheDocument();
    expect(screen.getByTestId('bold-1')).toBeInTheDocument();
  });

  // ── Empty state ───────────────────────────────────────────────

  it('shows default empty message when data is empty', () => {
    render(<Table columns={columns} data={[]} keyExtractor={keyExtractor} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('shows custom empty message', () => {
    render(
      <Table columns={columns} data={[]} keyExtractor={keyExtractor} emptyMessage="No users found" />
    );
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  // ── Loading state ─────────────────────────────────────────────

  it('shows loading indicator when loading=true', () => {
    render(<Table columns={columns} data={[]} keyExtractor={keyExtractor} loading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('does not show data rows when loading', () => {
    render(<Table columns={columns} data={sampleData} keyExtractor={keyExtractor} loading={true} />);
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  // ── Sorting ───────────────────────────────────────────────────

  it('shows ascending sort indicator for active sort column', () => {
    render(
      <Table
        columns={columns}
        data={sampleData}
        keyExtractor={keyExtractor}
        sortKey="name"
        sortDirection="asc"
      />
    );
    expect(screen.getByTestId('chevron-up')).toBeInTheDocument();
  });

  it('shows descending sort indicator for active sort column', () => {
    render(
      <Table
        columns={columns}
        data={sampleData}
        keyExtractor={keyExtractor}
        sortKey="name"
        sortDirection="desc"
      />
    );
    expect(screen.getByTestId('chevron-down')).toBeInTheDocument();
  });

  it('calls onSort when clicking a sortable column header', () => {
    const onSort = jest.fn();
    render(
      <Table columns={columns} data={sampleData} keyExtractor={keyExtractor} onSort={onSort} />
    );
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('does not call onSort for non-sortable columns', () => {
    const onSort = jest.fn();
    const nonSortableColumns: Column<TestRow>[] = [
      { key: 'name', header: 'Name', sortable: false },
    ];
    render(
      <Table columns={nonSortableColumns} data={sampleData} keyExtractor={keyExtractor} onSort={onSort} />
    );
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).not.toHaveBeenCalled();
  });

  // ── Pagination ────────────────────────────────────────────────

  it('renders pagination when totalPages > 1', () => {
    const onPageChange = jest.fn();
    render(
      <Table
        columns={columns}
        data={sampleData}
        keyExtractor={keyExtractor}
        page={1}
        totalPages={5}
        onPageChange={onPageChange}
      />
    );
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
  });

  it('does not render pagination when totalPages <= 1', () => {
    render(
      <Table
        columns={columns}
        data={sampleData}
        keyExtractor={keyExtractor}
        page={1}
        totalPages={1}
        onPageChange={jest.fn()}
      />
    );
    expect(screen.queryByText('Page 1 of 1')).not.toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    const onPageChange = jest.fn();
    render(
      <Table
        columns={columns}
        data={sampleData}
        keyExtractor={keyExtractor}
        page={1}
        totalPages={5}
        onPageChange={onPageChange}
      />
    );
    // The prev button (ChevronLeft parent) should be disabled
    const buttons = screen.getAllByRole('button');
    const prevButton = buttons[0]; // First pagination button
    expect(prevButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    const onPageChange = jest.fn();
    render(
      <Table
        columns={columns}
        data={sampleData}
        keyExtractor={keyExtractor}
        page={5}
        totalPages={5}
        onPageChange={onPageChange}
      />
    );
    const buttons = screen.getAllByRole('button');
    const nextButton = buttons[buttons.length - 1]; // Last pagination button
    expect(nextButton).toBeDisabled();
  });

  it('calls onPageChange with page-1 when clicking previous', () => {
    const onPageChange = jest.fn();
    render(
      <Table
        columns={columns}
        data={sampleData}
        keyExtractor={keyExtractor}
        page={3}
        totalPages={5}
        onPageChange={onPageChange}
      />
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // prev button
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with page+1 when clicking next', () => {
    const onPageChange = jest.fn();
    render(
      <Table
        columns={columns}
        data={sampleData}
        keyExtractor={keyExtractor}
        page={3}
        totalPages={5}
        onPageChange={onPageChange}
      />
    );
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]); // next button
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});
