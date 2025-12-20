'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Mail, Headphones, Sparkles } from 'lucide-react';
import { useSiteSettings } from '@/context/SiteSettingsContext';

const TELEGRAM_EN_URL = 'https://t.me/MarksAISupportEnglish';
const TELEGRAM_EN_HANDLE = '@MarksAISupportEnglish';
const TELEGRAM_CN_URL = 'https://t.me/MarksAISupportChinese';
const TELEGRAM_CN_HANDLE = '@MarksAISupportChinese';
const SUPPORT_EMAIL = 'support@markstrades.com';

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const settings = useSiteSettings();

  const telegramEnUrl = settings.telegram_en_url || TELEGRAM_EN_URL;
  const telegramEnHandle = settings.telegram_en || TELEGRAM_EN_HANDLE;
  const telegramCnUrl = settings.telegram_cn_url || TELEGRAM_CN_URL;
  const telegramCnHandle = settings.telegram_cn || TELEGRAM_CN_HANDLE;
  const supportEmail = settings.support_email || SUPPORT_EMAIL;

  return (
    <>
      {/* Floating Help Icon - Premium Animated Design */}
      <button
        type="button"
        aria-label="Open support center"
        onClick={() => setOpen(true)}
        className="fixed z-40 bottom-5 right-5 sm:bottom-8 sm:right-8 group"
      >
        {/* Outer glow ring */}
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-yellow-400 blur-md opacity-60 group-hover:opacity-100 animate-pulse transition-opacity" />
        {/* Ping animation */}
        <span className="absolute inset-0 rounded-full bg-cyan-400/40 animate-ping" />
        {/* Main button */}
        <span className="relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-cyan-500 via-cyan-400 to-yellow-400 shadow-2xl shadow-cyan-500/40 border-2 border-white/20 group-hover:scale-110 transition-transform duration-300">
          <Headphones className="w-6 h-6 sm:w-7 sm:h-7 text-black" />
        </span>
        {/* Badge */}
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-yellow-400 border-2 border-[#05060a] shadow-lg">
          <Sparkles className="w-3 h-3 text-black" />
        </span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in Support Panel - Premium Design */}
      <div
        className={`fixed z-50 inset-y-0 right-0 w-full max-w-md bg-gradient-to-b from-[#0a0f18] to-[#05060a] border-l border-white/10 shadow-2xl transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-5 border-b border-white/10 bg-gradient-to-r from-cyan-500/5 to-yellow-500/5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-cyan-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Headphones className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              </div>
              <div>
                <div className="text-base sm:text-lg text-white font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>SUPPORT CENTER</div>
                <div className="text-xs text-gray-400">24/7 Premium Support</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close support center"
              className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-6 space-y-4">
            <p className="text-sm text-gray-400 leading-relaxed">
              Get instant help via Telegram in English or Chinese. For billing inquiries, email us directly.
            </p>

            {/* Telegram English */}
            <a
              href={telegramEnUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gradient-to-br from-[#0d1420] to-[#0a0f18] border border-cyan-500/30 rounded-2xl p-4 hover:border-cyan-400/60 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 group hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-cyan-500/20">
                  <MessageCircle className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-cyan-300">🇺🇸 ENGLISH SUPPORT</span>
                  </div>
                  <div className="text-base text-white font-semibold">{telegramEnHandle}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Tap to open Telegram</div>
                </div>
              </div>
            </a>

            {/* Telegram Chinese */}
            <a
              href={telegramCnUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gradient-to-br from-[#0d1420] to-[#0a0f18] border border-yellow-500/30 rounded-2xl p-4 hover:border-yellow-400/60 hover:shadow-xl hover:shadow-yellow-500/10 transition-all duration-300 group hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-yellow-500/20">
                  <MessageCircle className="w-6 h-6 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-yellow-300">🇨🇳 中文客服</span>
                  </div>
                  <div className="text-base text-white font-semibold">{telegramCnHandle}</div>
                  <div className="text-xs text-gray-500 mt-0.5">点击打开 Telegram</div>
                </div>
              </div>
            </a>

            {/* Email Support */}
            <a
              href={`mailto:${supportEmail}`}
              className="block bg-gradient-to-br from-[#0d1420] to-[#0a0f18] border border-purple-500/30 rounded-2xl p-4 hover:border-purple-400/60 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 group hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-purple-500/20">
                  <Mail className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-purple-300">📧 EMAIL SUPPORT</span>
                  </div>
                  <div className="text-sm sm:text-base text-white font-semibold break-all">{supportEmail}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Billing & license inquiries</div>
                </div>
              </div>
            </a>

            {/* Full Support Page Link */}
            <div className="mt-4 border border-white/10 rounded-2xl p-4 bg-gradient-to-r from-cyan-500/5 to-yellow-500/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Need more help?</div>
                  <div className="text-xs text-gray-500">Visit our full support page with FAQ</div>
                </div>
                <Link
                  href="/contact"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-black text-xs font-bold hover:from-cyan-400 hover:to-yellow-400 transition-all shadow-lg shadow-cyan-500/20"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  OPEN
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
