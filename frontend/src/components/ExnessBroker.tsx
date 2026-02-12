'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, CheckCircle, Shield, Zap, DollarSign, Wallet, Gift } from 'lucide-react';

const EXNESS_REFERRAL_LINK = 'https://one.exnessonelink.com/a/ustbuprn';

interface ExnessBrokerProps {
  variant?: 'full' | 'compact';
}

export default function ExnessBroker({ variant = 'full' }: ExnessBrokerProps) {
  const handleClick = () => {
    window.open(EXNESS_REFERRAL_LINK, '_blank', 'noopener,noreferrer');
  };

  if (variant === 'compact') {
    return (
      <div 
        onClick={handleClick}
        className="relative overflow-hidden bg-gradient-to-r from-[#0d1117] via-[#161b22] to-[#0d1117] border-2 border-yellow-500/40 rounded-2xl cursor-pointer hover:border-yellow-400/70 hover:shadow-xl hover:shadow-yellow-500/20 transition-all duration-300 group"
      >
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-orange-500/10 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-orange-400 to-yellow-500" />
        
        <div className="relative p-4 sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Logo */}
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-400/30 rounded-xl blur-md" />
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#1a1a2e] to-[#0d0d15] rounded-xl p-2 border border-yellow-500/30 shadow-lg">
                <Image 
                  src="/exness.png" 
                  alt="Exness" 
                  width={64} 
                  height={64} 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className="text-[9px] sm:text-[10px] font-bold text-yellow-300 bg-gradient-to-r from-yellow-500/30 to-orange-500/20 px-2 py-0.5 rounded-full border border-yellow-400/40 shadow-sm">
                  ⭐ MUST USE BROKER
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded-full border border-red-400/40 animate-pulse">
                  CENT ACCOUNT
                </span>
              </div>
              <h4 className="text-white font-bold text-sm sm:text-base leading-tight" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Exness Standard Cent
              </h4>
              <p className="text-gray-400 text-[10px] sm:text-xs mt-0.5">Low spreads • Instant deposit & withdrawal</p>
            </div>
            
            {/* CTA Button */}
            <div className="flex-shrink-0">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg shadow-lg shadow-yellow-500/30 group-hover:shadow-yellow-500/50 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] sm:text-xs font-bold text-black whitespace-nowrap">Open Account</span>
                  <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-black" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Free EA Promo Bar */}
        <div className="relative border-t border-green-500/30 bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-green-500/10">
          <Link
            href="/free-EA-trading"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 hover:bg-green-500/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
              <span className="text-[10px] sm:text-xs text-green-300 font-semibold">Get FREE EA Subscription — Open account under our link!</span>
            </div>
            <span className="text-[10px] sm:text-xs text-green-400 font-bold whitespace-nowrap hover:text-green-300 transition-colors flex items-center gap-1">
              See Details <ExternalLink className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#12121a] via-[#1a1a2e] to-[#12121a] border border-yellow-500/30 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 px-4 sm:px-6 py-3 border-b border-yellow-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-white rounded-xl p-2 shadow-lg">
              <Image 
                src="/exness.png" 
                alt="Exness" 
                width={80} 
                height={80} 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                <span className="text-[10px] sm:text-xs font-bold text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-500/30">
                  ⭐ RECOMMENDED BROKER
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse">
                  🔴 CENT ACCOUNT ONLY
                </span>
              </div>
              <h3 className="text-white font-bold text-base sm:text-xl" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Exness Broker
              </h3>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-green-400 text-xs">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Trusted Worldwide
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {/* Important Warning */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 sm:p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="text-red-400 font-bold text-sm sm:text-base mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                IMPORTANT: Cent Account Required!
              </h4>
              <p className="text-red-300/80 text-xs sm:text-sm">
                Our EA is designed to work <span className="font-bold text-red-400">ONLY on Standard Cent Account</span>. 
                Using other account types may result in unexpected behavior or losses.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-yellow-400 font-bold text-base sm:text-lg mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Why Exness Standard Cent Account?
          </h4>
          <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
            Our EA is specifically optimized for <span className="text-yellow-400 font-semibold">Exness Standard Cent Account</span>. 
            This account type provides the perfect conditions for our grid trading strategy with minimal risk exposure.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-5">
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-cyan-400" />
              <span className="text-white text-xs sm:text-sm font-semibold">Low Spreads</span>
            </div>
            <p className="text-gray-500 text-[10px] sm:text-xs">From 0.3 pips on Gold</p>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-green-400" />
              <span className="text-white text-xs sm:text-sm font-semibold">Instant Execution</span>
            </div>
            <p className="text-gray-500 text-[10px] sm:text-xs">No requotes</p>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-yellow-400" />
              <span className="text-white text-xs sm:text-sm font-semibold">Cent Account</span>
            </div>
            <p className="text-gray-500 text-[10px] sm:text-xs">Start with $10 only</p>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-purple-400" />
              <span className="text-white text-xs sm:text-sm font-semibold">EA Friendly</span>
            </div>
            <p className="text-gray-500 text-[10px] sm:text-xs">No restrictions</p>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-white text-xs sm:text-sm font-semibold">Instant Deposit</span>
            </div>
            <p className="text-gray-500 text-[10px] sm:text-xs">Deposit & withdraw instantly</p>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg p-3 border border-pink-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-pink-400" />
              <span className="text-white text-xs sm:text-sm font-semibold">Fast Withdrawal</span>
            </div>
            <p className="text-gray-500 text-[10px] sm:text-xs">Get money in seconds</p>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-[#0a0a0f] rounded-lg p-4 mb-5 border border-cyan-500/10">
          <h5 className="text-cyan-400 font-semibold text-xs sm:text-sm mb-3">Quick Start Steps:</h5>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 text-xs font-bold flex-shrink-0">1</span>
              <p className="text-gray-400 text-xs sm:text-sm">Click the button below to create your Exness account</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 text-xs font-bold flex-shrink-0">2</span>
              <p className="text-gray-400 text-xs sm:text-sm">Open a <span className="text-yellow-400 font-semibold">Standard Cent</span> account (MT5)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 text-xs font-bold flex-shrink-0">3</span>
              <p className="text-gray-400 text-xs sm:text-sm">Deposit minimum $10 and connect our EA</p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleClick}
          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 flex items-center justify-center gap-2 group"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          <span>OPEN EXNESS ACCOUNT</span>
          <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
        </button>
        
        <p className="text-center text-gray-600 text-[10px] sm:text-xs mt-3">
          Opens in new tab • Free registration • No minimum deposit required
        </p>
      </div>
    </div>
  );
}
