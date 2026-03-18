'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Phone, Shield } from 'lucide-react';
import api from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/request-otp', { phone: `+91${phone}` });
      setStep('otp');
    } catch {
      setError('Failed to send OTP. Please check your phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(`+91${phone}`, otp);
      router.replace('/dashboard');
    } catch {
      setError('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Aarokya Control Center</h1>
          <p className="mt-1 text-sm text-gray-500">Operator dashboard for healthcare management</p>
        </div>

        <div className="card">
          {step === 'phone' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Sign In</h2>
              <p className="text-sm text-gray-500">
                Enter your registered phone number to receive an OTP
              </p>

              <div className="flex items-end gap-2">
                <div className="flex h-[38px] items-center rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                  +91
                </div>
                <div className="flex-1">
                  <Input
                    label="Phone Number"
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    icon={<Phone className="h-4 w-4" />}
                    error={error && step === 'phone' ? error : undefined}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                loading={loading}
                disabled={phone.length !== 10}
              >
                Request OTP
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Verify OTP</h2>
              <p className="text-sm text-gray-500">
                Enter the 6-digit code sent to +91 {phone}
              </p>

              <Input
                label="OTP Code"
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                icon={<Shield className="h-4 w-4" />}
                error={error && step === 'otp' ? error : undefined}
              />

              <Button
                type="submit"
                className="w-full"
                loading={loading}
                disabled={otp.length !== 6}
              >
                Verify & Sign In
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                className="w-full text-center text-sm text-primary hover:underline"
              >
                Change phone number
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Access restricted to authorized operators only.
        </p>
      </div>
    </div>
  );
}
