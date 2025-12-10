'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://markstrades.com/api';

interface DashboardContextType {
  user: any;
  licenses: any[];
  selectedLicense: any;
  settings: any;
  setSettings: (settings: any) => void;
  selectLicense: (license: any) => void;
  clearSelectedLicense: () => void;
  logout: () => void;
  refreshLicenses: () => void;
  API_URL: string;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch fresh licenses from server
  const fetchLicensesFromServer = async (email: string) => {
    try {
      const res = await fetch(`${API_URL}/licenses/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        setLicenses(data.licenses);
        localStorage.setItem('licenses', JSON.stringify(data.licenses));
      }
    } catch (e) {
      console.error('Failed to fetch licenses from server');
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const licensesData = localStorage.getItem('licenses');
    const selectedLicenseData = localStorage.getItem('selectedLicense');
    
    if (!userData) {
      router.push('/');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    
    // Load from localStorage first, then refresh from server
    if (licensesData) {
      const lics = JSON.parse(licensesData);
      setLicenses(lics);
    }
    
    // Fetch fresh data from server
    if (parsedUser?.email) {
      fetchLicensesFromServer(parsedUser.email);
    }
    
    if (selectedLicenseData) {
      try {
        const lic = JSON.parse(selectedLicenseData);
        setSelectedLicense(lic);
        if (lic && lic.ea_settings) {
          setSettings(lic.ea_settings);
        }
      } catch (error) {
        console.error('Error parsing selected license:', error);
        localStorage.removeItem('selectedLicense');
      }
    }
    
    setLoading(false);
  }, [router]);

  const selectLicense = (lic: any) => {
    setSelectedLicense(lic);
    localStorage.setItem('selectedLicense', JSON.stringify(lic));
    
    // Update the license in the licenses array
    const updatedLicenses = licenses.map(license => 
      license.license_key === lic.license_key ? lic : license
    );
    setLicenses(updatedLicenses);
    localStorage.setItem('licenses', JSON.stringify(updatedLicenses));
    
    if (lic && lic.ea_settings) {
      setSettings(lic.ea_settings);
    }
    // Fetch fresh settings
    if (lic && lic.license_key) {
      fetchSettings(lic.license_key);
    }
  };

  const fetchSettings = async (licenseKey: string, symbol: string = 'BTCUSD') => {
    try {
      const res = await fetch(`${API_URL}/settings/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey, mt5_account: '', symbol: symbol })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error('Failed to fetch settings');
    }
  };

  const refreshLicenses = async () => {
    // Re-fetch from localStorage (could also fetch from server)
    const licensesData = localStorage.getItem('licenses');
    if (licensesData) {
      setLicenses(JSON.parse(licensesData));
    }
  };

  const clearSelectedLicense = () => {
    setSelectedLicense(null);
    setSettings(null);
    localStorage.removeItem('selectedLicense');
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('licenses');
    localStorage.removeItem('selectedLicense');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={{
      user,
      licenses,
      selectedLicense,
      settings,
      setSettings,
      selectLicense,
      clearSelectedLicense,
      logout,
      refreshLicenses,
      API_URL
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}
