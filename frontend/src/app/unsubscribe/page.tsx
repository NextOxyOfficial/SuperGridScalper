'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import { CheckCircle, Mail } from 'lucide-react';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    const token = searchParams?.get('token') || '';
    if (!token) return;

    const run = async () => {
      setError('');
      setInfo('');
      setLoading(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';
        const res = await fetch(`${API_URL}/unsubscribe/one-click/?token=${encodeURIComponent(token)}`, {
          method: 'GET',
        });
        const data = await res.json();
        if (data.success) {
          setUnsubscribed(true);
          setInfo(data.message || 'You have been unsubscribed.');
        } else {
          setError(data.message || 'Invalid unsubscribe link.');
        }
      } catch {
        setError('Failed to unsubscribe. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [searchParams]);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';
      const response = await fetch(`${API_URL}/unsubscribe/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setUnsubscribed(true);
        setInfo(data.message || 'You have been unsubscribed.');
      } else {
        setError(data.message || 'Failed to unsubscribe. Please try again.');
      }
    } catch (err) {
      setError('Failed to unsubscribe. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f]">
      <Header />
      
      <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24">
        {!unsubscribed ? (
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-2xl p-8 sm:p-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 rounded-full mb-4">
                <Mail className="w-8 h-8 text-cyan-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Unsubscribe from Emails
              </h1>
              <p className="text-gray-400 text-sm sm:text-base">
                We're sorry to see you go. Enter your email address to unsubscribe from our mailing list.
              </p>
            </div>

            <form onSubmit={handleUnsubscribe} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {info && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-300 text-sm">{info}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 px-6 rounded-lg transition"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {loading ? 'Processing...' : 'Unsubscribe'}
              </button>

              <p className="text-center text-gray-500 text-xs">
                Note: You will still receive important account-related emails (license expiry, payment confirmations, etc.)
              </p>
            </form>

            <div className="mt-8 pt-8 border-t border-cyan-500/10 text-center">
              <p className="text-gray-400 text-sm mb-4">
                Changed your mind?
              </p>
              <Link 
                href="/"
                className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition text-sm font-medium"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-[#12121a] border border-green-500/20 rounded-2xl p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full mb-6">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Successfully Unsubscribed
            </h2>
            <p className="text-gray-400 mb-6">
              You have been removed from our mailing list. You will no longer receive marketing emails from us.
            </p>
            <p className="text-gray-500 text-sm mb-8">
              You will still receive important account-related notifications such as license expiry reminders and payment confirmations.
            </p>
            <Link 
              href="/"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-bold py-3 px-6 rounded-lg transition"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Return to Home
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
