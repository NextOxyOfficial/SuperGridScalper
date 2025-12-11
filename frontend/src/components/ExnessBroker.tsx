'use client';

import Image from 'next/image';
import { ExternalLink, CheckCircle, Shield, Zap, DollarSign, Wallet } from 'lucide-react';

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
        className="bg-gradient-to-r from-[#12121a] to-[#1a1a2e] border border-yellow-500/30 rounded-xl p-4 cursor-pointer hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-500/10 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-xl p-2 flex-shrink-0 shadow-lg">
            <Image 
              src="/exness.png" 
              alt="Exness" 
              width={80} 
              height={80} 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              <span className="text-[10px] sm:text-xs font-bold text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-500/30">
                ⭐ MUST USE BROKER
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse">
                🔴 CENT ACCOUNT ONLY
              </span>
            </div>
            <h4 className="text-white font-bold text-sm sm:text-base" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Exness Standard Cent Account
            </h4>
            <p className="text-gray-400 text-[10px] sm:text-xs">EA must run on Cent Account • Low spreads • Instant execution</p>
          </div>
          <div className="flex items-center gap-1 text-yellow-400 group-hover:translate-x-1 transition-transform">
            <span className="text-xs font-semibold hidden sm:inline">Open Account</span>
            <ExternalLink className="w-4 h-4" />
          </div>
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
                  ⭐ MUST USE BROKER
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
