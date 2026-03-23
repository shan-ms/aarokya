/**
 * ART: BalanceCard Component Tests
 *
 * Tests balance display, paise-to-rupees formatting with Indian
 * numbering system, currency symbol rendering, and add money action.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BalanceCard, {
  formatCurrency,
} from '../../components/home/BalanceCard';

describe('formatCurrency', () => {
  describe('basic conversions (paise to rupees)', () => {
    it('should convert 0 paise to "0.00"', () => {
      expect(formatCurrency(0)).toBe('0.00');
    });

    it('should convert 100 paise to "1.00"', () => {
      expect(formatCurrency(100)).toBe('1.00');
    });

    it('should convert 50 paise to "0.50"', () => {
      expect(formatCurrency(50)).toBe('0.50');
    });

    it('should convert 999 paise to "9.99"', () => {
      expect(formatCurrency(999)).toBe('9.99');
    });

    it('should convert 10000 paise to "100.00"', () => {
      expect(formatCurrency(10000)).toBe('100.00');
    });
  });

  describe('Indian numbering system (comma separators)', () => {
    it('should format 500000 paise as "5,000.00" (5,000 rupees)', () => {
      // 500000 / 100 = 5000 -> "5,000.00"
      expect(formatCurrency(500000)).toBe('5,000.00');
    });

    it('should format 10000000 paise as "1,00,000.00" (1 lakh rupees)', () => {
      // 10000000 / 100 = 100000 -> "1,00,000.00"
      expect(formatCurrency(10000000)).toBe('1,00,000.00');
    });

    it('should format 100000000 paise as "10,00,000.00" (10 lakh rupees)', () => {
      // 100000000 / 100 = 1000000 -> "10,00,000.00"
      expect(formatCurrency(100000000)).toBe('10,00,000.00');
    });

    it('should format 1000000000 paise as "1,00,00,000.00" (1 crore rupees)', () => {
      // 1000000000 / 100 = 10000000 -> "1,00,00,000.00"
      expect(formatCurrency(1000000000)).toBe('1,00,00,000.00');
    });

    it('should not add comma for amounts under 1,000 rupees', () => {
      // 99900 paise = 999 rupees
      expect(formatCurrency(99900)).toBe('999.00');
    });

    it('should format 399900 paise as "3,999.00" (basic insurance threshold)', () => {
      expect(formatCurrency(399900)).toBe('3,999.00');
    });

    it('should format 1000000 paise as "10,000.00" (premium insurance threshold)', () => {
      expect(formatCurrency(1000000)).toBe('10,000.00');
    });
  });

  describe('edge cases', () => {
    it('should handle single paise', () => {
      expect(formatCurrency(1)).toBe('0.01');
    });

    it('should handle 150000 paise (from docstring example)', () => {
      expect(formatCurrency(150000)).toBe('1,500.00');
    });
  });
});

describe('BalanceCard component', () => {
  const mockOnAddMoney = jest.fn();

  beforeEach(() => {
    mockOnAddMoney.mockClear();
  });

  it('should render the balance label', () => {
    const { getByText } = render(
      <BalanceCard balance={0} onAddMoney={mockOnAddMoney} />,
    );

    expect(getByText('home.hsa_balance')).toBeTruthy();
  });

  it('should render the rupee symbol', () => {
    const { getAllByText } = render(
      <BalanceCard balance={500000} onAddMoney={mockOnAddMoney} />,
    );

    // The currency symbol is rendered as a separate Text element
    const rupeeSymbols = getAllByText(/₹/);
    expect(rupeeSymbols.length).toBeGreaterThan(0);
  });

  it('should render formatted balance for 500000 paise (5,000.00)', () => {
    const { getByText } = render(
      <BalanceCard balance={500000} onAddMoney={mockOnAddMoney} />,
    );

    // The balance text contains the formatted amount
    expect(getByText(/5,000\.00/)).toBeTruthy();
  });

  it('should render zero balance as 0.00', () => {
    const { getByText } = render(
      <BalanceCard balance={0} onAddMoney={mockOnAddMoney} />,
    );

    expect(getByText(/0\.00/)).toBeTruthy();
  });

  it('should render large balance with Indian formatting', () => {
    const { getByText } = render(
      <BalanceCard balance={10000000} onAddMoney={mockOnAddMoney} />,
    );

    // 10000000 paise = 1,00,000 rupees
    expect(getByText(/1,00,000\.00/)).toBeTruthy();
  });

  it('should render "add money" button', () => {
    const { getByText } = render(
      <BalanceCard balance={0} onAddMoney={mockOnAddMoney} />,
    );

    expect(getByText('home.add_money')).toBeTruthy();
  });

  it('should call onAddMoney when add money button is pressed', () => {
    const { getByText } = render(
      <BalanceCard balance={0} onAddMoney={mockOnAddMoney} />,
    );

    fireEvent.press(getByText('home.add_money'));

    expect(mockOnAddMoney).toHaveBeenCalledTimes(1);
  });

  it('should not call onAddMoney on balance text press', () => {
    const { getByText } = render(
      <BalanceCard balance={500000} onAddMoney={mockOnAddMoney} />,
    );

    fireEvent.press(getByText(/5,000\.00/));

    expect(mockOnAddMoney).not.toHaveBeenCalled();
  });
});
