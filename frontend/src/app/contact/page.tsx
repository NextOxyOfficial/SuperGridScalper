'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bot, Mail, MessageCircle, Send, CheckCircle, AlertCircle, ArrowLeft, ArrowRight, Store, LogIn, Zap, Clock } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

const TELEGRAM_EN_URL = 'https://t.me/MarksAISupportEnglish';
const TELEGRAM_EN_HANDLE = '@MarksAISupportEnglish';
const TELEGRAM_CN_URL = 'https://t.me/MarksAISupportChinese';
const TELEGRAM_CN_HANDLE = '@MarksAISupportChinese';
const SUPPORT_EMAIL = 'support@markstrades.com';

export default function ContactPage() {
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
    <main className="min-h-screen bg-[#05060a] relative">
      {/* Subtle Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.015)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px]" />

      {/* Compact Navigation */}
      <nav className="relative z-20 bg-[#05060a]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-yellow-400 rounded-lg flex items-center justify-center">
                <Bot className="w-4 h-4 text-black" />
              </div>
              <span className="text-base font-bold text-white hidden sm:block" style={{ fontFamily: 'Orbitron, sans-serif' }}>MARK'S AI <span className="text-cyan-400">3.0</span></span>
            </Link>
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  <Link href="/dashboard" className="px-3 py-1.5 text-gray-400 hover:text-white text-xs font-medium transition rounded-md hover:bg-white/5">Dashboard</Link>
                  <Link href="/ea-store" className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-yellow-400 text-xs font-medium border border-yellow-500/20 rounded-md hover:bg-yellow-500/10 transition">
                    <Store className="w-3.5 h-3.5" /> Store
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/" className="px-3 py-1.5 text-gray-400 hover:text-white text-xs font-medium transition rounded-md hover:bg-white/5">Home</Link>
                  <Link href="/" className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 text-black text-xs font-bold rounded-md hover:bg-cyan-400 transition">
                    <LogIn className="w-3.5 h-3.5" /> Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Compact */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Compact Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Contact <span className="text-cyan-400">Support</span>
          </h1>
          <p className="text-gray-500 text-sm">Get help via Telegram or Email • 24/7 Available</p>
        </div>

        {/* Compact Contact Cards - Horizontal on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {/* Telegram English */}
          <a
            href={TELEGRAM_EN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 bg-[#0a0e14] border border-cyan-500/20 rounded-xl p-4 hover:border-cyan-400/50 hover:bg-[#0c1218] transition-all"
          >
            <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold text-cyan-300/80">🇺🇸 ENGLISH</span>
              </div>
              <p className="text-white font-semibold text-sm truncate">{TELEGRAM_EN_HANDLE}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-cyan-400/50 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </a>

          {/* Telegram Chinese */}
          <a
            href={TELEGRAM_CN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 bg-[#0a0e14] border border-yellow-500/20 rounded-xl p-4 hover:border-yellow-400/50 hover:bg-[#0c1218] transition-all"
          >
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold text-yellow-300/80">🇨🇳 中文</span>
              </div>
              <p className="text-white font-semibold text-sm truncate">{TELEGRAM_CN_HANDLE}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-yellow-400/50 group-hover:text-yellow-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </a>

          {/* Email */}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="group flex items-center gap-3 bg-[#0a0e14] border border-purple-500/20 rounded-xl p-4 hover:border-purple-400/50 hover:bg-[#0c1218] transition-all"
          >
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center group-hover:bg-purple-500/20 transition-colors flex-shrink-0">
              <Mail className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold text-purple-300/80">📧 EMAIL</span>
              </div>
              <p className="text-white font-semibold text-sm truncate">{SUPPORT_EMAIL}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-purple-400/50 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </a>
        </div>

        {/* Info Bar */}
        <div className="flex items-center justify-center gap-6 mb-8 py-3 px-4 bg-[#0a0e14]/50 border border-white/5 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Fast Response</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5 text-yellow-400" />
            <span>24/7 Available</span>
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

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-8">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center gap-4 text-xs text-gray-600">
          <Link href="/guideline" className="hover:text-cyan-400 transition">Guidelines</Link>
          <span>•</span>
          <Link href="/ea-store" className="hover:text-cyan-400 transition">EA Store</Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-cyan-400 transition">Terms</Link>
          <span>•</span>
          <span>© {new Date().getFullYear()} Mark's AI</span>
        </div>
      </footer>
    </main>
  );
}
