'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to public EA Store page
export default function DashboardEAStorePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ea-store');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Redirecting to EA Store...</p>
    </div>
  );
}
