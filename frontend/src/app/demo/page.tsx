'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Eye, EyeOff, Loader2, Play, Copy, Check } from 'lucide-react';

const DEMO_EMAIL = 'demo@marksai.com';
const DEMO_PASSWORD = 'demo123456';

export default function DemoLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(DEMO_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(DEMO_PASSWORD);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleAutoFill = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('licenses', JSON.stringify(data.licenses || []));
        router.push('/dashboard');
      } else {
        setError(data.message || 'Invalid demo credentials');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-yellow-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Demo Badge */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-green-500/20 to-cyan-500/20 border border-green-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
            <Play className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
            <span className="text-green-300 text-xs sm:text-sm font-semibold" style={{ fontFamily: 'Orbitron, sans-serif' }}>DEMO MODE</span>
          </div>
        </div>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Bot className="w-5 h-5 sm:w-7 sm:h-7 text-black" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI 3.0</h1>
            <p className="text-cyan-400 text-[10px] sm:text-xs">Demo Dashboard Access</p>
          </div>
        </div>

        {/* Demo Credentials Card */}
        <div className="bg-gradient-to-br from-green-500/10 to-cyan-500/10 border border-green-500/30 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <h3 className="text-green-400 font-bold text-xs sm:text-sm mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <Play className="w-3 h-3 sm:w-4 sm:h-4" /> DEMO CREDENTIALS
          </h3>
          
          <div className="space-y-2 sm:space-y-3">
            {/* Demo Email */}
            <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg p-2 sm:p-3 border border-cyan-500/20">
              <div>
                <p className="text-gray-500 text-[10px] sm:text-xs mb-0.5">Email</p>
                <p className="text-cyan-400 font-mono text-xs sm:text-sm">{DEMO_EMAIL}</p>
              </div>
              <button
                onClick={handleCopyEmail}
                className="p-1.5 sm:p-2 hover:bg-cyan-500/20 rounded-lg transition-colors"
              >
                {copiedEmail ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" /> : <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />}
              </button>
            </div>

            {/* Demo Password */}
            <div className="flex items-center justify-between bg-[#0a0a0f] rounded-lg p-2 sm:p-3 border border-cyan-500/20">
              <div>
                <p className="text-gray-500 text-[10px] sm:text-xs mb-0.5">Password</p>
                <p className="text-cyan-400 font-mono text-xs sm:text-sm">{DEMO_PASSWORD}</p>
              </div>
              <button
                onClick={handleCopyPassword}
                className="p-1.5 sm:p-2 hover:bg-cyan-500/20 rounded-lg transition-colors"
              >
                {copiedPassword ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" /> : <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />}
              </button>
            </div>
          </div>

          {/* Auto-fill Button */}
          <button
            onClick={handleAutoFill}
            className="w-full mt-2 sm:mt-3 py-1.5 sm:py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs sm:text-sm font-semibold transition-colors border border-green-500/30"
          >
            ⚡ Auto-fill Credentials
          </button>
        </div>

        {/* Login Form */}
        <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <h2 className="text-base sm:text-xl font-bold text-white mb-3 sm:mb-4 text-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Demo Login
          </h2>

          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter demo email"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-white placeholder-gray-600 text-sm sm:text-base"
                required
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter demo password"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0f] border border-cyan-500/30 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-white placeholder-gray-600 pr-10 sm:pr-12 text-sm sm:text-base"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400 text-black rounded-xl font-bold text-sm sm:text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  LOGGING IN...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                  ACCESS DEMO
                </>
              )}
            </button>
          </form>

          {/* Back to Home */}
          <div className="mt-3 sm:mt-4 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-gray-500 hover:text-cyan-400 text-xs sm:text-sm transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>

        {/* Info Note */}
        <div className="mt-3 sm:mt-4 text-center">
          <p className="text-gray-600 text-[10px] sm:text-xs">
            Demo account has limited features. <br />
            <span className="text-cyan-400">Purchase a license</span> for full access.
          </p>
        </div>
      </div>
    </main>
  );
}
