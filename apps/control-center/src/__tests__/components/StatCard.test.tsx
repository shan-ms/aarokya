/**
 * ART – StatCard component tests
 *
 * Covers:
 *  - Renders label, value, and icon
 *  - Trend indicators (up/down/neutral)
 *  - Trend label display
 *  - No trend section when trend is undefined
 *  - Custom className passthrough
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import StatCard from '@/components/ui/StatCard';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  TrendingUp: (props: Record<string, unknown>) => <svg data-testid="trending-up" {...props} />,
  TrendingDown: (props: Record<string, unknown>) => <svg data-testid="trending-down" {...props} />,
  Minus: (props: Record<string, unknown>) => <svg data-testid="minus-icon" {...props} />,
}));

const defaultProps = {
  icon: <span data-testid="test-icon">IC</span>,
  label: 'Total Users',
  value: '24,583',
};

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard {...defaultProps} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('24,583')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    render(<StatCard {...defaultProps} />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('shows TrendingUp icon for positive trend', () => {
    render(<StatCard {...defaultProps} trend={12.5} />);
    expect(screen.getByTestId('trending-up')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('shows TrendingDown icon for negative trend', () => {
    render(<StatCard {...defaultProps} trend={-5.2} />);
    expect(screen.getByTestId('trending-down')).toBeInTheDocument();
    expect(screen.getByText('-5.2%')).toBeInTheDocument();
  });

  it('shows Minus icon for zero trend', () => {
    render(<StatCard {...defaultProps} trend={0} />);
    expect(screen.getByTestId('minus-icon')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('does not render trend section when trend is undefined', () => {
    render(<StatCard {...defaultProps} />);
    expect(screen.queryByTestId('trending-up')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trending-down')).not.toBeInTheDocument();
    expect(screen.queryByTestId('minus-icon')).not.toBeInTheDocument();
  });

  it('renders trend label when provided', () => {
    render(<StatCard {...defaultProps} trend={8.3} trendLabel="vs last month" />);
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('does not render trend label when not provided', () => {
    render(<StatCard {...defaultProps} trend={5} />);
    expect(screen.queryByText('vs last month')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatCard {...defaultProps} className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('renders correctly with all props (snapshot-like check)', () => {
    render(
      <StatCard
        icon={<span data-testid="test-icon">IC</span>}
        label="Daily Contributions"
        value="₹3.45L"
        trend={15.2}
        trendLabel="vs yesterday"
      />
    );
    expect(screen.getByText('Daily Contributions')).toBeInTheDocument();
    expect(screen.getByText('₹3.45L')).toBeInTheDocument();
    expect(screen.getByText('+15.2%')).toBeInTheDocument();
    expect(screen.getByText('vs yesterday')).toBeInTheDocument();
  });
});
