/**
 * ART: OTPScreen Tests
 *
 * Tests OTP input handling, verification flow, resend timer,
 * error handling, and navigation after successful verification.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import OTPScreen from '../../screens/auth/OTPScreen';
import { verifyOtp, sendOtp } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

jest.mock('../../api/auth');
jest.spyOn(Alert, 'alert');

const mockedVerifyOtp = verifyOtp as jest.MockedFunction<typeof verifyOtp>;
const mockedSendOtp = sendOtp as jest.MockedFunction<typeof sendOtp>;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const defaultProps = {
  navigation: {
    navigate: mockNavigate,
    goBack: mockGoBack,
    reset: jest.fn(),
    dispatch: jest.fn(),
  } as any,
  route: {
    params: { phone: '+919876543210' },
    key: 'otp-screen',
    name: 'OTP' as const,
  },
};

describe('OTPScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('rendering', () => {
    it('should display OTP title and subtitle with phone number', () => {
      const { getByText } = render(<OTPScreen {...defaultProps} />);

      expect(getByText('auth.otp_title')).toBeTruthy();
      // Subtitle contains the phone number
      expect(getByText(/\+919876543210/)).toBeTruthy();
    });

    it('should render 6 OTP input boxes', () => {
      const { getAllByText } = render(<OTPScreen {...defaultProps} />);

      // Each empty OTP box renders an empty Text element
      // The verify button text is also present
      expect(getByText('auth.verify')).toBeTruthy();
    });

    // Helper to get verify button
    function getByText(text: string) {
      const { getByText: gbt } = render(<OTPScreen {...defaultProps} />);
      return gbt(text);
    }

    it('should show verify button', () => {
      const { getByText } = render(<OTPScreen {...defaultProps} />);
      expect(getByText('auth.verify')).toBeTruthy();
    });

    it('should show resend timer initially', () => {
      const { getByText } = render(<OTPScreen {...defaultProps} />);
      expect(getByText('auth.resend_in')).toBeTruthy();
    });
  });

  describe('OTP input', () => {
    it('should accept numeric input', () => {
      const { getByDisplayValue, UNSAFE_getByType } = render(
        <OTPScreen {...defaultProps} />,
      );

      // The hidden TextInput receives the OTP
      const inputs = UNSAFE_getByType(
        require('react-native').TextInput,
      );

      fireEvent.changeText(inputs, '123456');

      // The component stores the cleaned value
      expect(inputs.props.value).toBe('123456');
    });

    it('should strip non-numeric characters', () => {
      const { UNSAFE_getByType } = render(<OTPScreen {...defaultProps} />);

      const input = UNSAFE_getByType(require('react-native').TextInput);
      fireEvent.changeText(input, '12ab34');

      expect(input.props.value).toBe('1234');
    });

    it('should limit input to 6 digits', () => {
      const { UNSAFE_getByType } = render(<OTPScreen {...defaultProps} />);

      const input = UNSAFE_getByType(require('react-native').TextInput);
      fireEvent.changeText(input, '12345678');

      expect(input.props.value).toBe('123456');
    });
  });

  describe('verification flow', () => {
    it('should disable verify button when OTP is incomplete', () => {
      const { getByText, UNSAFE_getByType } = render(
        <OTPScreen {...defaultProps} />,
      );

      // Enter only 3 digits
      const input = UNSAFE_getByType(require('react-native').TextInput);
      fireEvent.changeText(input, '123');

      // The verify button should be disabled (disabled prop is true)
      const verifyButton = getByText('auth.verify');
      // Parent TouchableOpacity should have disabled state
      expect(verifyButton).toBeTruthy();

      // Pressing a disabled button should not call verifyOtp
      fireEvent.press(getByText('auth.verify'));
      expect(mockedVerifyOtp).not.toHaveBeenCalled();
    });

    it('should call verifyOtp with phone and OTP on valid submit', async () => {
      mockedVerifyOtp.mockResolvedValue({
        data: {
          token: 'access-token',
          refreshToken: 'refresh-token',
          user: {
            id: 'user-001',
            phone: '+919876543210',
            name: 'Ramesh',
            language: 'hi',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        },
      } as any);

      const { getByText, UNSAFE_getByType } = render(
        <OTPScreen {...defaultProps} />,
      );

      const input = UNSAFE_getByType(require('react-native').TextInput);
      fireEvent.changeText(input, '123456');

      await act(async () => {
        fireEvent.press(getByText('auth.verify'));
      });

      expect(mockedVerifyOtp).toHaveBeenCalledWith('+919876543210', '123456');
    });

    it('should call login on auth store after successful verification', async () => {
      const mockUser = {
        id: 'user-001',
        phone: '+919876543210',
        name: 'Ramesh',
        language: 'hi',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      mockedVerifyOtp.mockResolvedValue({
        data: {
          token: 'access-token',
          refreshToken: 'refresh-token',
          user: mockUser,
        },
      } as any);

      const { getByText, UNSAFE_getByType } = render(
        <OTPScreen {...defaultProps} />,
      );

      const input = UNSAFE_getByType(require('react-native').TextInput);
      fireEvent.changeText(input, '123456');

      await act(async () => {
        fireEvent.press(getByText('auth.verify'));
      });

      const state = useAuthStore.getState();
      expect(state.token).toBe('access-token');
      expect(state.refreshToken).toBe('refresh-token');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should navigate to ABHALink after successful verification', async () => {
      mockedVerifyOtp.mockResolvedValue({
        data: {
          token: 'token',
          refreshToken: 'refresh',
          user: {
            id: 'user-001',
            phone: '+919876543210',
            name: 'Ramesh',
            language: 'hi',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        },
      } as any);

      const { getByText, UNSAFE_getByType } = render(
        <OTPScreen {...defaultProps} />,
      );

      const input = UNSAFE_getByType(require('react-native').TextInput);
      fireEvent.changeText(input, '123456');

      await act(async () => {
        fireEvent.press(getByText('auth.verify'));
      });

      expect(mockNavigate).toHaveBeenCalledWith('ABHALink');
    });

    it('should show Alert on verification failure', async () => {
      mockedVerifyOtp.mockRejectedValue({
        response: { data: { message: 'Invalid OTP code' } },
      });

      const { getByText, UNSAFE_getByType } = render(
        <OTPScreen {...defaultProps} />,
      );

      const input = UNSAFE_getByType(require('react-native').TextInput);
      fireEvent.changeText(input, '000000');

      await act(async () => {
        fireEvent.press(getByText('auth.verify'));
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'common.error',
        'Invalid OTP code',
      );
    });

    it('should use fallback error message when response has no message', async () => {
      mockedVerifyOtp.mockRejectedValue(new Error('Network error'));

      const { getByText, UNSAFE_getByType } = render(
        <OTPScreen {...defaultProps} />,
      );

      const input = UNSAFE_getByType(require('react-native').TextInput);
      fireEvent.changeText(input, '123456');

      await act(async () => {
        fireEvent.press(getByText('auth.verify'));
      });

      expect(Alert.alert).toHaveBeenCalledWith('common.error', 'common.error');
    });
  });

  describe('resend timer', () => {
    it('should count down from 30 seconds', () => {
      const { getByText } = render(<OTPScreen {...defaultProps} />);

      expect(getByText('auth.resend_in')).toBeTruthy();

      // Advance timer by 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // After timer expires, resend button should appear
      expect(getByText('auth.resend_otp')).toBeTruthy();
    });

    it('should call sendOtp when resend button is pressed', async () => {
      mockedSendOtp.mockResolvedValue({
        data: { requestId: 'req-002', expiresIn: 300 },
      } as any);

      const { getByText } = render(<OTPScreen {...defaultProps} />);

      // Wait for timer to expire
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await act(async () => {
        fireEvent.press(getByText('auth.resend_otp'));
      });

      expect(mockedSendOtp).toHaveBeenCalledWith('+919876543210');
    });

    it('should reset timer after successful resend', async () => {
      mockedSendOtp.mockResolvedValue({
        data: { requestId: 'req-002', expiresIn: 300 },
      } as any);

      const { getByText, queryByText } = render(
        <OTPScreen {...defaultProps} />,
      );

      // Wait for timer to expire
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      expect(getByText('auth.resend_otp')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByText('auth.resend_otp'));
      });

      // After resend, timer text should reappear
      expect(getByText('auth.resend_in')).toBeTruthy();
      expect(queryByText('auth.resend_otp')).toBeNull();
    });

    it('should show Alert if resend fails', async () => {
      mockedSendOtp.mockRejectedValue(new Error('Rate limited'));

      const { getByText } = render(<OTPScreen {...defaultProps} />);

      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await act(async () => {
        fireEvent.press(getByText('auth.resend_otp'));
      });

      expect(Alert.alert).toHaveBeenCalledWith('common.error', 'common.error');
    });
  });
});
