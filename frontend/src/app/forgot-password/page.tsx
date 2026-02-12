'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import SiteLogo from '@/components/SiteLogo';
import Header from '@/components/Header';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

export default function ForgotAccessKeyPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/password-reset/request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.message || 'Failed to request access key reset');
      } else {
        setSubmitted(true);
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
            href="/"
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
            <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Forgot Access Key
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm">We'll email you a reset link</p>
            </div>
          </div>

          {submitted ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <p className="text-green-300 font-medium">Request submitted</p>
                  <p className="text-gray-400 text-xs sm:text-sm mt-1">
                    If an account exists for this email, you will receive a reset link shortly.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  href="/"
                  className="text-cyan-400 hover:text-cyan-300 text-xs sm:text-sm font-medium"
                >
                  Return to Home
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 text-sm sm:text-base transition-all"
                  placeholder="your@email.com"
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
                className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 disabled:opacity-50 text-black rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
