'use client';

import Link from 'next/link';
import { Bot } from 'lucide-react';
import { useSiteSettings } from '@/context/SiteSettingsContext';

type Size = 'sm' | 'md' | 'lg';

export default function SiteLogo({
  href = '/',
  size = 'md',
  showText = true,
  className = '',
}: {
  href?: string;
  size?: Size;
  showText?: boolean;
  className?: string;
}) {
  const settings = useSiteSettings();

  const iconClassName =
    size === 'sm'
      ? 'w-4 h-4'
      : size === 'lg'
        ? 'w-6 h-6'
        : 'w-5 h-5';

  const boxClassName =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : size === 'lg'
        ? 'w-12 h-12 rounded-xl'
        : 'w-10 h-10 rounded-xl';

  const textClassName =
    size === 'sm'
      ? 'text-sm'
      : size === 'lg'
        ? 'text-xl'
        : 'text-base';

  return (
    <Link href={href} className={`flex items-center gap-2.5 hover:opacity-90 transition ${className}`}>
      <div className={`${boxClassName} bg-gradient-to-br from-cyan-400 to-yellow-400 flex items-center justify-center overflow-hidden`}>
        {settings.logo_url ? (
          <img
            src={settings.logo_url}
            alt={settings.site_name}
            className="w-full h-full object-contain bg-black/5"
          />
        ) : (
          <Bot className={`${iconClassName} text-black`} />
        )}
      </div>

      {showText && (
        <span className={`${textClassName} font-bold text-white`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
          {settings.logo_text}
          {settings.logo_version ? (
            <span className="text-cyan-400"> {settings.logo_version}</span>
          ) : null}
        </span>
      )}
    </Link>
  );
}
