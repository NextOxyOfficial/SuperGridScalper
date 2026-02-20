'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, MessageCircle, Send, CheckCircle, AlertCircle, ArrowLeft, ArrowRight, Store, LogIn, Zap, Clock } from 'lucide-react';
import SiteLogo from '@/components/SiteLogo';
import Header from '@/components/Header';
import { useSiteSettings } from '@/context/SiteSettingsContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

const TELEGRAM_EN_URL = 'https://t.me/MarksAISupportEnglish';
const TELEGRAM_EN_HANDLE = '@MarksAISupportEnglish';
const TELEGRAM_CN_URL = 'https://t.me/MarksAISupportChinese';
const TELEGRAM_CN_HANDLE = '@MarksAISupportChinese';
const SUPPORT_EMAIL = 'support@markstrades.com';

export default function ContactPage() {
  const settings = useSiteSettings();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    category: 'general'
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const telegramEnUrl = settings.telegram_en_url || TELEGRAM_EN_URL;
  const telegramEnHandle = settings.telegram_en || TELEGRAM_EN_HANDLE;
  const telegramCnUrl = settings.telegram_cn_url || TELEGRAM_CN_URL;
  const telegramCnHandle = settings.telegram_cn || TELEGRAM_CN_HANDLE;
  const supportEmail = settings.support_email || SUPPORT_EMAIL;

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setIsLoggedIn(true);
      const user = JSON.parse(userData);
      setUserName(user.name || user.email || 'User');
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/contact/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.message || 'Failed to send message.');
      }
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-500/10 rounded-full blur-[120px] animate-pulse" />

      <Header />

      {/* Navigation - Different for logged in vs non-logged in */}
      <nav className="hidden relative z-20 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
            {isLoggedIn ? (
              <>
                {/* Logged In: Dashboard Style Header */}
                <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <SiteLogo size="sm" />
                  </div>
                </div>
                
                {/* Nav buttons row */}
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                  <Link
                    href="/dashboard"
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/ea-store"
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    EA Store
                  </Link>
                  <Link
                    href="/guideline"
                    className="flex-1 sm:flex-none text-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition text-cyan-300 hover:text-white hover:bg-cyan-500/20 border border-cyan-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Guidelines
                  </Link>
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="h-5 w-px bg-cyan-500/30"></div>
                    <span className="text-cyan-300 text-xs sm:text-sm">{userName}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Non-Logged In: Homepage Style Header */}
                <div className="flex items-center gap-2 sm:gap-4">
                  <SiteLogo size="sm" />
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link 
                    href="/" 
                    className="px-3 sm:px-4 py-2 sm:py-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-lg text-xs sm:text-sm font-medium transition border border-cyan-500/30"
                  >
                    Home
                  </Link>
                  <Link 
                    href="/guideline" 
                    className="px-3 sm:px-4 py-2 sm:py-2 text-cyan-300 hover:text-white hover:bg-cyan-500/20 rounded-lg text-xs sm:text-sm font-medium transition border border-cyan-500/30"
                  >
                    Guidelines
                  </Link>
                  <Link 
                    href="/" 
                    className="px-3 sm:px-4 py-2 sm:py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5"
                  >
                    <LogIn className="w-4 h-4 sm:w-4 sm:h-4" /> Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4">
            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
            <span className="text-cyan-400 text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>SUPPORT CENTER</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-2 sm:mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Get Help & Support
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto px-2">
            Contact us via Telegram or Email • Available 24/7
          </p>
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {/* Telegram English */}
          <a
            href={telegramEnUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-[#0a0a0f]/50 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 hover:border-cyan-400 hover:bg-[#0a0a0f]/80 transition-all"
          >
            <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors flex-shrink-0">
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] sm:text-xs font-bold text-cyan-300/70">🇺🇸 ENGLISH</span>
                </div>
                <h3 className="text-white font-bold text-base sm:text-lg mb-1">Telegram Support</h3>
                <p className="text-cyan-400 text-xs sm:text-sm font-medium">{telegramEnHandle}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm text-gray-400">
              <span>Instant Response</span>
              <ArrowRight className="w-4 h-4 text-cyan-400/50 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
          </a>

          {/* Telegram Chinese - Temporarily Unavailable */}
          <div
            className="bg-[#0a0a0f]/50 border border-yellow-500/20 rounded-2xl p-5 sm:p-6 opacity-50 cursor-not-allowed"
          >
            <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-yellow-500/5 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400/50" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] sm:text-xs font-bold text-yellow-300/50">🇨🇳 中文</span>
                  <span className="text-[8px] sm:text-[9px] font-bold text-red-300 bg-red-500/20 px-1.5 py-0.5 rounded-full border border-red-400/30">UNAVAILABLE</span>
                </div>
                <h3 className="text-gray-500 font-bold text-base sm:text-lg mb-1">Telegram 支持</h3>
                <p className="text-gray-600 text-xs sm:text-sm font-medium">{telegramCnHandle}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
              <span>Temporarily unavailable</span>
            </div>
          </div>

          {/* Email */}
          <a
            href={`mailto:${supportEmail}`}
            className="group bg-[#0a0a0f]/50 border border-purple-500/30 rounded-2xl p-5 sm:p-6 hover:border-purple-400 hover:bg-[#0a0a0f]/80 transition-all"
          >
            <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-purple-500/10 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 transition-colors flex-shrink-0">
                <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] sm:text-xs font-bold text-purple-300/70">📧 EMAIL</span>
                </div>
                <h3 className="text-white font-bold text-base sm:text-lg mb-1">Email Support</h3>
                <p className="text-purple-400 text-xs sm:text-sm font-medium">{supportEmail}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm text-gray-400">
              <span>24-48 Hour Response</span>
              <ArrowRight className="w-4 h-4 text-purple-400/50 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
            </div>
          </a>
        </div>

        {/* Info Bar */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mb-8 sm:mb-12 py-3 sm:py-4 px-4 bg-[#0a0a0f]/50 border border-cyan-500/20 rounded-xl">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="font-medium">Fast Response</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="font-medium">24/7 Available</span>
          </div>
        </div>

        {/* Contact Form - Compact */}
        <div className="max-w-2xl mx-auto bg-[#0a0e14] border border-white/10 rounded-xl p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-cyan-500/10 rounded-lg flex items-center justify-center">
              <Send className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Send Message</h2>
              <p className="text-gray-500 text-xs">We'll respond within 24 hours</p>
            </div>
          </div>

          {submitted ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Sent!</h3>
              <p className="text-gray-500 text-sm mb-4">We'll get back to you soon.</p>
              <button
                onClick={() => { setSubmitted(false); setFormData(prev => ({ ...prev, subject: '', message: '', category: 'general' })); }}
                className="text-cyan-400 hover:text-cyan-300 text-xs font-medium"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 bg-[#05060a] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                  placeholder="Name"
                />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 bg-[#05060a] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                  placeholder="Email"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#05060a] border border-white/10 rounded-lg text-sm text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                >
                  <option value="general">General</option>
                  <option value="technical">Technical</option>
                  <option value="license">License</option>
                  <option value="billing">Billing</option>
                  <option value="refund">Refund</option>
                </select>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 bg-[#05060a] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                  placeholder="Subject"
                />
              </div>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={4}
                className="w-full px-3 py-2.5 bg-[#05060a] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 resize-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                placeholder="Your message..."
              />
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded-lg text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-700 disabled:to-gray-600 text-black disabled:text-gray-500 py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" /> SENDING...</>
                ) : (
                  <><Send className="w-4 h-4" /> SEND</>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-cyan-400 transition text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
