'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Mail, Send } from 'lucide-react';

const TELEGRAM_URL = 'https://t.me/MarksAISupport';
const TELEGRAM_HANDLE = '@MarksAISupport';
const SUPPORT_EMAIL = 'support@markstrades.com';

export default function SupportWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Help Icon */}
      <button
        type="button"
        aria-label="Open support center"
        onClick={() => setOpen(true)}
        className="fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/30 border border-cyan-300/80 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-transform duration-200 hover:scale-105"
      >
        <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in Support Panel */}
      <div
        className={`fixed z-50 inset-y-0 right-0 w-full max-w-sm bg-[#05060a] border-l border-cyan-500/30 shadow-2xl transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-cyan-500/30 bg-[#05060a]/95">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-yellow-400 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-black" />
              </div>
              <div>
                <div className="text-xs sm:text-sm text-cyan-300 font-semibold">SUPPORT CENTER</div>
                <div className="text-[10px] sm:text-xs text-gray-400">Need help? Contact us anytime.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close support center"
              className="p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
            <p className="text-xs sm:text-sm text-gray-400">
              Fastest support via Telegram. You can also reach us by email for billing or license issues.
            </p>

            {/* Telegram Support */}
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-[#0a0f18] border border-cyan-500/40 rounded-xl p-3 sm:p-4 hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-500/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                  <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-cyan-300">Telegram Support</div>
                  <div className="text-sm sm:text-base text-white font-semibold">{TELEGRAM_HANDLE}</div>
                  <div className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Click to open chat in Telegram</div>
                </div>
              </div>
            </a>

            {/* Email Support */}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="block bg-[#0a0f18] border border-yellow-500/30 rounded-xl p-3 sm:p-4 hover:border-yellow-300 hover:shadow-lg hover:shadow-yellow-500/10 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-yellow-500/15 flex items-center justify-center group-hover:bg-yellow-500/25 transition-colors">
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-yellow-300">Email Support</div>
                  <div className="text-sm sm:text-base text-white font-semibold break-all">{SUPPORT_EMAIL}</div>
                  <div className="text-[11px] sm:text-xs text-gray-400 mt-0.5">For billing, license & account questions</div>
                </div>
              </div>
            </a>

            {/* Full Support Page Link */}
            <div className="mt-2 border border-cyan-500/20 rounded-xl p-3 bg-[#05060a]/80">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-gray-300">Need detailed help?</div>
                  <div className="text-[11px] sm:text-xs text-gray-500">Visit our full support & FAQ page.</div>
                </div>
                <Link
                  href="/contact"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 text-[11px] sm:text-xs hover:bg-cyan-500/20 border border-cyan-500/40 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  Open Support Page
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
