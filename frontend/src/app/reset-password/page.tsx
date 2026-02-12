'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, ArrowLeft, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import SiteLogo from '@/components/SiteLogo';
import Header from '@/components/Header';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

export default function ResetAccessKeyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const uid = useMemo(() => searchParams.get('uid') || '', [searchParams]);
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid || !token) {
      setError('Invalid reset link. Please request a new one.');
    }
  }, [uid, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!uid || !token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    if (password.length < 6) {
      setError('Access key must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Access keys do not match');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/password-reset/confirm/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.message || 'Failed to reset access key');
      } else {
        setSubmitted(true);
        setTimeout(() => router.push('/'), 1200);
      }
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] animate-pulse" />

      <Header />

      {/* Header */}
      <nav className="hidden relative z-20 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <SiteLogo size="sm" />
          <Link
            href="/forgot-password"
            className="text-cyan-300 hover:text-white text-xs sm:text-sm px-3 sm:px-4 py-2 hover:bg-cyan-500/20 rounded-lg transition border border-cyan-500/30 flex items-center gap-2"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-3 sm:px-4 py-10">
        <div className="bg-[#12121a] border border-cyan-500/20 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-cyan-500/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Reset Access Key
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm">Choose a new access key</p>
            </div>
          </div>

          {submitted ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <p className="text-green-300 font-medium">Access key updated</p>
                  <p className="text-gray-400 text-xs sm:text-sm mt-1">Redirecting…</p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">New Access Key</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pr-10 px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 text-sm sm:text-base transition-all"
                    placeholder="Min 6 characters"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-300"
                    aria-label={showPassword ? 'Hide access key' : 'Show access key'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">Confirm Access Key</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 text-sm sm:text-base transition-all"
                  placeholder="Confirm access key"
                  minLength={6}
                />
              </div>

              {error ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 sm:p-3 text-red-400 text-xs sm:text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-cyan-400 disabled:opacity-50 text-black rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/25"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Access Key'
                )}
              </button>

              <div className="text-center pt-2">
                <Link href="/" className="text-gray-500 hover:text-cyan-300 text-xs sm:text-sm">
                  Return to Home
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
