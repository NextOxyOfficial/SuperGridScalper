'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

interface SiteSettings {
  site_name: string;
  site_tagline: string;
  favicon_url: string | null;
  logo_url: string | null;
  logo_text: string;
  logo_version: string;
  support_email: string;
  telegram_en: string;
  telegram_en_url: string;
  telegram_cn: string;
  telegram_cn_url: string;
}

const defaultSettings: SiteSettings = {
  site_name: "MARK'S AI 3.0",
  site_tagline: "Advanced Gold Scalping EA",
  favicon_url: null,
  logo_url: null,
  logo_text: "MARK'S AI",
  logo_version: "3.0",
  support_email: "support@markstrades.com",
  telegram_en: "@MarksAISupportEnglish",
  telegram_en_url: "https://t.me/MarksAISupportEnglish",
  telegram_cn: "@MarksAISupportChinese",
  telegram_cn_url: "https://t.me/MarksAISupportChinese",
};

const SiteSettingsContext = createContext<SiteSettings>(defaultSettings);

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/site-settings/`);
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings({ ...defaultSettings, ...data.settings });
        }
      } catch (err) {
        console.error('Failed to fetch site settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // Dynamically update favicon when settings change
  useEffect(() => {
    if (settings.favicon_url) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.favicon_url;
    }
  }, [settings.favicon_url]);

  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
}
