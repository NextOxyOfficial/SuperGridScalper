'use client';

import Link from 'next/link';
import SiteLogo from '@/components/SiteLogo';
import { useSiteSettings } from '@/context/SiteSettingsContext';

export default function Footer() {
  const year = new Date().getFullYear();
  const settings = useSiteSettings();

  return (
    <footer className="relative z-10 border-t border-white/5 bg-[#05060a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
          <Link href="/guideline" className="text-gray-500 hover:text-cyan-400 transition">
            Guidelines
          </Link>
          <span className="text-gray-700">•</span>
          <Link href="/ea-store" className="text-gray-500 hover:text-cyan-400 transition">
            EA Store
          </Link>
          <span className="text-gray-700">•</span>
          <Link href="/contact" className="text-gray-500 hover:text-cyan-400 transition">
            Contact Support
          </Link>
          <span className="text-gray-700">•</span>
          <Link href="/terms" className="text-gray-500 hover:text-cyan-400 transition">
            Terms
          </Link>
          <span className="text-gray-700">•</span>
          <Link href="/privacy" className="text-gray-500 hover:text-cyan-400 transition">
            Privacy
          </Link>
        </div>

        <div className="mt-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <SiteLogo size="sm" />
          </div>
          <p className="text-gray-600 text-xs">© {year} {settings.logo_text}. All rights reserved.</p>
        </div>

        {/* Risk Disclaimer */}
        <div className="mt-4 pt-4 border-t border-gray-800/50">
          <p className="text-gray-600 text-[10px] sm:text-xs text-center leading-relaxed max-w-3xl mx-auto">
            <span className="text-gray-500 font-semibold">Risk Disclaimer:</span> Trading forex and CFDs involves significant risk and may not be suitable for all investors. 
            Past performance does not guarantee future results. You should not invest money that you cannot afford to lose. 
            The free license offer is subject to verification and may be withdrawn at any time.
          </p>
        </div>
      </div>
    </footer>
  );
}
