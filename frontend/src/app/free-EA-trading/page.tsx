'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, Gift, Zap, Shield, TrendingUp, ArrowRight, ExternalLink, Star, Bot, DollarSign, Clock, Users } from 'lucide-react';
import Header from '@/components/Header';
import axios from 'axios';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000/api'
    : 'https://markstrades.com/api');

const EXNESS_REFERRAL_LINK = 'https://one.exnessonelink.com/a/ustbuprn';

export default function FreeTradingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    setIsLoggedIn(!!userData);

    // Track referral code from URL — store in both localStorage and cookie for robust tracking
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('referral_code', ref);
      document.cookie = `referral_code=${ref}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
      axios.post(`${API_URL}/referral/track-click/`, { referral_code: ref }).catch(() => {});
    }
  }, [searchParams]);

  const handleGetStarted = () => {
    if (isLoggedIn) {
      router.push('/dashboard');
    } else {
      router.push('/?action=register');
    }
  };

  const handleOpenExness = () => {
    window.open(EXNESS_REFERRAL_LINK, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 sm:pt-28 pb-16 sm:pb-24">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-green-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2 mb-6 sm:mb-8">
            <Gift className="w-4 h-4 text-green-400" />
            <span className="text-green-300 text-xs sm:text-sm font-semibold">LIMITED TIME OFFER</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Get <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">FREE</span> AI Trading License
          </h1>
          <p className="text-gray-400 text-base sm:text-xl max-w-2xl mx-auto mb-3 sm:mb-4 leading-relaxed">
            Open an Exness account <span className="text-yellow-400 font-bold">under our referral link</span> and get a <span className="text-green-400 font-bold">completely free license</span> for 
            our AI-powered gold trading bot. No payment required.
          </p>
          <p className="text-red-400/80 text-xs sm:text-sm max-w-xl mx-auto mb-3">
            * Your Exness account must be created through our referral link. Accounts not under our referral will not qualify for the free license.
          </p>
          <p className="text-yellow-400 text-sm sm:text-base font-semibold mb-8 sm:mb-10">
            Start automated gold trading with just $10 deposit — zero subscription cost!
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={handleGetStarted}
              className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 text-black px-8 py-4 rounded-xl font-bold text-sm sm:text-base transition-all transform hover:scale-105 shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Gift className="w-5 h-5" />
              {isLoggedIn ? 'GO TO DASHBOARD' : 'GET STARTED FREE'}
            </button>
            <button
              onClick={handleOpenExness}
              className="w-full sm:w-auto bg-gradient-to-r from-yellow-500/10 to-orange-500/10 hover:from-yellow-500/20 hover:to-orange-500/20 border-2 border-yellow-500/40 hover:border-yellow-400 text-yellow-300 px-8 py-4 rounded-xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <ExternalLink className="w-5 h-5" />
              OPEN EXNESS ACCOUNT
            </button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mt-8 sm:mt-12 text-gray-500 text-[10px] sm:text-xs">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-green-400" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              <span>Instant Setup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-green-400" />
              <span>24/5 Automated Trading</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-20 border-t border-green-500/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="relative bg-gradient-to-r from-[#0a0a0f] via-[#12121a] to-[#0a0a0f] border border-green-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-12 overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(34,197,94,0.03)_50%,transparent_100%)] animate-pulse" />

            <div className="relative z-10">
              <div className="text-center mb-6 sm:mb-10">
                <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-white mb-2 sm:mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  Get Your Free License in <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">3 Simple Steps</span>
                </h2>
                <p className="text-gray-500 text-xs sm:text-base">From account creation to automated trading — completely free!</p>
              </div>

              {/* Step Indicators */}
              <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-10">
                {[
                  { num: 1, label: 'Open', color: 'yellow' },
                  { num: 2, label: 'Claim', color: 'cyan' },
                  { num: 3, label: 'Trade', color: 'green' },
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 sm:gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg ${
                        step.color === 'yellow' ? 'bg-yellow-500 text-black shadow-yellow-500/50' :
                        step.color === 'cyan' ? 'bg-cyan-500 text-black shadow-cyan-500/50' :
                        'bg-green-500 text-black shadow-green-500/50'
                      }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>{step.num}</div>
                      <span className={`text-[9px] sm:text-xs font-semibold ${
                        step.color === 'yellow' ? 'text-yellow-400' :
                        step.color === 'cyan' ? 'text-cyan-400' :
                        'text-green-400'
                      }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>{step.label}</span>
                    </div>
                    {idx < 2 && <div className="w-8 sm:w-16 md:w-24 h-px bg-gradient-to-r from-gray-700 to-gray-800 mt-[-12px]" />}
                  </div>
                ))}
              </div>

              {/* Step Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {/* Step 1 */}
                <div className="bg-gradient-to-br from-[#12121a] to-[#0d1117] border border-yellow-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-500/5 transition-all group">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-yellow-500/10 border border-yellow-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Image src="/exness.png" alt="Exness" width={40} height={40} className="w-7 h-7 sm:w-9 sm:h-9 object-contain" />
                  </div>
                  <h3 className="text-white font-bold text-xs sm:text-base mb-1.5 sm:mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Open Exness Account</h3>
                  <p className="text-gray-400 text-[10px] sm:text-sm leading-relaxed mb-3">
                    Create your free Exness account. Choose <span className="text-yellow-400 font-semibold">Standard Cent</span> account type.
                  </p>
                  <button
                    onClick={handleOpenExness}
                    className="inline-flex items-center gap-1.5 text-yellow-400 hover:text-yellow-300 text-[10px] sm:text-sm font-semibold transition-colors"
                  >
                    Open Account <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>

                {/* Step 2 */}
                <div className="bg-gradient-to-br from-[#12121a] to-[#0d1117] border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/5 transition-all group">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-cyan-500/10 border border-cyan-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" />
                  </div>
                  <h3 className="text-white font-bold text-xs sm:text-base mb-1.5 sm:mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Register & Claim</h3>
                  <p className="text-gray-400 text-[10px] sm:text-sm leading-relaxed mb-3">
                    Create your account, go to dashboard, and claim your <span className="text-green-400 font-semibold">free license</span> with your MT5 number.
                  </p>
                  <button
                    onClick={handleGetStarted}
                    className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-[10px] sm:text-sm font-semibold transition-colors"
                  >
                    {isLoggedIn ? 'Go to Dashboard' : 'Register Now'} <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>

                {/* Step 3 */}
                <div className="bg-gradient-to-br from-[#12121a] to-[#0d1117] border border-green-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:border-green-400/50 hover:shadow-lg hover:shadow-green-500/5 transition-all group">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-500/10 border border-green-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-green-400" />
                  </div>
                  <h3 className="text-white font-bold text-xs sm:text-base mb-1.5 sm:mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Start Trading</h3>
                  <p className="text-gray-400 text-[10px] sm:text-sm leading-relaxed mb-3">
                    Once verified, your license activates instantly. Deposit as little as <span className="text-yellow-400 font-semibold">$10</span> and let AI trade for you 24/5.
                  </p>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="text-center mt-6 sm:mt-10">
                <p className="text-xs sm:text-lg text-gray-300 mb-3 sm:mb-4">
                  <span className="text-green-400 font-bold">No payment required.</span> Start trading with AI for free.
                </p>
                <button
                  onClick={handleGetStarted}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-cyan-400 text-black px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-base transition-all transform hover:scale-105 shadow-lg shadow-green-500/25"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  {isLoggedIn ? 'CLAIM FREE LICENSE' : 'GET STARTED FREE'} <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-transparent via-green-500/[0.02] to-transparent border-t border-green-500/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2 mb-4">
              <Star className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-xs sm:text-sm font-semibold">WHAT YOU GET</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Everything Included — For Free
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-4 sm:p-5 text-center hover:border-cyan-400/40 transition-all">
              <Bot className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <h4 className="text-white font-bold text-xs sm:text-sm mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>AI Trading Bot</h4>
              <p className="text-gray-500 text-[10px] sm:text-xs">Advanced gold scalping EA with AI-powered entries</p>
            </div>
            <div className="bg-[#12121a] border border-green-500/20 rounded-xl p-4 sm:p-5 text-center hover:border-green-400/40 transition-all">
              <Zap className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h4 className="text-white font-bold text-xs sm:text-sm mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>24/5 Automation</h4>
              <p className="text-gray-500 text-[10px] sm:text-xs">Trades automatically while you sleep</p>
            </div>
            <div className="bg-[#12121a] border border-yellow-500/20 rounded-xl p-4 sm:p-5 text-center hover:border-yellow-400/40 transition-all">
              <DollarSign className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
              <h4 className="text-white font-bold text-xs sm:text-sm mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Start with $10</h4>
              <p className="text-gray-500 text-[10px] sm:text-xs">Cent account means minimal risk exposure</p>
            </div>
            <div className="bg-[#12121a] border border-purple-500/20 rounded-xl p-4 sm:p-5 text-center hover:border-purple-400/40 transition-all">
              <Shield className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <h4 className="text-white font-bold text-xs sm:text-sm mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Risk Management</h4>
              <p className="text-gray-500 text-[10px] sm:text-xs">Built-in recovery mode & smart grid system</p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 sm:mt-12 grid grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-xl p-4 sm:p-6 text-center">
              <p className="text-2xl sm:text-4xl font-bold text-green-400 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>5%-250%</p>
              <p className="text-gray-400 text-[10px] sm:text-xs">Expected Daily Profit</p>
            </div>
            <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-xl p-4 sm:p-6 text-center">
              <p className="text-2xl sm:text-4xl font-bold text-cyan-400 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>24/5</p>
              <p className="text-gray-400 text-[10px] sm:text-xs">Automated Trading</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20 rounded-xl p-4 sm:p-6 text-center">
              <p className="text-2xl sm:text-4xl font-bold text-yellow-400 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>$0</p>
              <p className="text-gray-400 text-[10px] sm:text-xs">License Cost</p>
            </div>
          </div>
        </div>
      </section>

      {/* Exness Section */}
      <section className="py-16 sm:py-24 border-t border-yellow-500/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-2 mb-4">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 text-xs sm:text-sm font-semibold">STEP 1: OPEN BROKER ACCOUNT</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Why Exness Standard Cent?
            </h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
              Our AI bot is optimized for Exness Standard Cent accounts — the safest way to start automated trading.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
            <div className="bg-[#12121a] border border-yellow-500/20 rounded-xl p-3 sm:p-4">
              <DollarSign className="w-5 h-5 text-yellow-400 mb-2" />
              <p className="text-white text-xs sm:text-sm font-semibold">Low Spreads</p>
              <p className="text-gray-500 text-[10px] sm:text-xs">From 0.3 pips on Gold</p>
            </div>
            <div className="bg-[#12121a] border border-green-500/20 rounded-xl p-3 sm:p-4">
              <Zap className="w-5 h-5 text-green-400 mb-2" />
              <p className="text-white text-xs sm:text-sm font-semibold">Instant Execution</p>
              <p className="text-gray-500 text-[10px] sm:text-xs">No requotes</p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-3 sm:p-4">
              <Shield className="w-5 h-5 text-cyan-400 mb-2" />
              <p className="text-white text-xs sm:text-sm font-semibold">Cent Account</p>
              <p className="text-gray-500 text-[10px] sm:text-xs">Start with just $10</p>
            </div>
            <div className="bg-[#12121a] border border-purple-500/20 rounded-xl p-3 sm:p-4">
              <CheckCircle className="w-5 h-5 text-purple-400 mb-2" />
              <p className="text-white text-xs sm:text-sm font-semibold">EA Friendly</p>
              <p className="text-gray-500 text-[10px] sm:text-xs">No restrictions on bots</p>
            </div>
            <div className="bg-[#12121a] border border-emerald-500/20 rounded-xl p-3 sm:p-4">
              <Clock className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-white text-xs sm:text-sm font-semibold">Instant Deposit</p>
              <p className="text-gray-500 text-[10px] sm:text-xs">Fund in seconds</p>
            </div>
            <div className="bg-[#12121a] border border-pink-500/20 rounded-xl p-3 sm:p-4">
              <TrendingUp className="w-5 h-5 text-pink-400 mb-2" />
              <p className="text-white text-xs sm:text-sm font-semibold">Fast Withdrawal</p>
              <p className="text-gray-500 text-[10px] sm:text-xs">Get money instantly</p>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleOpenExness}
              className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black px-10 py-4 rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 flex items-center justify-center gap-2 mx-auto group"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Image src="/exness.png" alt="Exness" width={24} height={24} className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
              OPEN EXNESS ACCOUNT
              <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-gray-600 text-[10px] sm:text-xs mt-3">
              Opens in new tab • Free registration • No minimum deposit required
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-24 border-t border-cyan-500/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {[
              {
                q: 'Is this really free? What\'s the catch?',
                a: 'Yes, it\'s completely free! We earn a small commission from Exness when you trade through your account. That\'s how we can offer the license for free — it\'s a win-win.',
              },
              {
                q: 'How long does the free license last?',
                a: 'You get a full monthly license for free. As long as you continue trading with your Exness account through our link, you can request renewal.',
              },
              {
                q: 'How much money do I need to start?',
                a: 'You can start with as little as $10 on an Exness Standard Cent account. The cent account means your risk is minimal while you learn.',
              },
              {
                q: 'How do I verify my account?',
                a: 'After submitting your claim, contact our customer support. They will verify that your Exness account was created through our referral link and activate your license.',
              },
              {
                q: 'What is the expected profit?',
                a: 'Our AI trading bot targets 5%-250% Daily profit on gold trading. Results vary based on market conditions and your deposit amount. Past performance does not guarantee future results.',
              },
              {
                q: 'Can I use this on multiple accounts?',
                a: 'Each free license is valid for one MT5 account. If you need more accounts, you can purchase additional licenses from our dashboard.',
              },
            ].map((faq, i) => (
              <details key={i} className="bg-[#12121a] border border-cyan-500/20 rounded-xl overflow-hidden group">
                <summary className="p-4 sm:p-5 cursor-pointer text-white font-semibold text-xs sm:text-sm flex items-center justify-between gap-3 hover:bg-cyan-500/5 transition-colors">
                  <span>{faq.q}</span>
                  <svg className="w-4 h-4 text-cyan-400 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-gray-400 text-xs sm:text-sm leading-relaxed border-t border-cyan-500/10 pt-3">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 border-t border-green-500/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="bg-gradient-to-br from-green-500/10 via-[#12121a] to-emerald-500/10 border-2 border-green-500/30 rounded-2xl p-8 sm:p-12">
            <Gift className="w-12 h-12 sm:w-16 sm:h-16 text-green-400 mx-auto mb-4 sm:mb-6" />
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3 sm:mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Ready to Start Trading for Free?
            </h2>
            <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-8 max-w-lg mx-auto">
              Join hundreds of traders using our AI bot. Open an Exness account, claim your free license, and let the AI work for you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleOpenExness}
                className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black px-8 py-4 rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <ExternalLink className="w-5 h-5" />
                1. OPEN EXNESS ACCOUNT
              </button>
              <button
                onClick={handleGetStarted}
                className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 text-black px-8 py-4 rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <Gift className="w-5 h-5" />
                2. CLAIM FREE LICENSE
              </button>
            </div>
            <p className="text-gray-600 text-[10px] sm:text-xs mt-4">
              After opening your Exness account, register on our platform and claim your free license from the dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Risk Disclaimer */}
      <div className="border-t border-gray-800 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <p className="text-gray-600 text-[10px] sm:text-xs text-center leading-relaxed">
            <span className="text-gray-500 font-semibold">Risk Disclaimer:</span> Trading forex and CFDs involves significant risk and may not be suitable for all investors. 
            Past performance does not guarantee future results. You should not invest money that you cannot afford to lose. 
            The free license offer is subject to verification and may be withdrawn at any time.
          </p>
        </div>
      </div>
    </main>
  );
}
