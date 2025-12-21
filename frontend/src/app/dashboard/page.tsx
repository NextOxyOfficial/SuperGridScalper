'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check, X, Sparkles, CheckCircle, Loader2, Upload, RefreshCw, Wallet, Clock } from 'lucide-react';
import { useDashboard } from './context';
import axios from 'axios';
import ExnessBroker from '@/components/ExnessBroker';
import QRCode from 'qrcode';

const POLLING_INTERVAL = 2000; // Faster polling for real-time updates
const EA_CONNECTED_TIMEOUT_SECONDS = 30; // Allow up to 30s between heartbeats before marking disconnected

export default function DashboardHome() {
  const { user, licenses, selectedLicense, selectLicense, clearSelectedLicense, settings, API_URL, refreshLicenses } = useDashboard();
  
  // Trading state
  const [tradeData, setTradeData] = useState<any>(null);
  const [allTradeData, setAllTradeData] = useState<{[key: string]: any}>({});
  const [actionLogs, setActionLogs] = useState<{time: string, type: string, message: string}[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [eaConnected, setEaConnected] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // Purchase state
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [mt5Account, setMt5Account] = useState('');
  const [paymentNetworks, setPaymentNetworks] = useState<any[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>('');
  const [txid, setTxid] = useState('');
  const [userNote, setUserNote] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<any>(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [purchaseStep, setPurchaseStep] = useState<1 | 2>(1);
  const [refreshing, setRefreshing] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [walletCopied, setWalletCopied] = useState(false);

  const lastAutoLicenseRefreshRef = useRef<number>(0);
  const purchaseRequestsPollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Positions tab state
  const [positionsTab, setPositionsTab] = useState<'open' | 'closed'>('open');
  const closedPositionsRef = useRef<HTMLDivElement>(null);

  // Extend license modal state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendingPlan, setExtendingPlan] = useState<number | null>(null);

  const allLicensesPollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Keep closed positions scroll at top (latest positions shown first via reverse order)

  useEffect(() => {
    fetchPlans();
    fetchPaymentNetworks();
    fetchPurchaseRequests();
    // Fetch trade data for all licenses initially
    fetchAllLicensesTradeData();
    
    // Start polling for all licenses data (only when no license is selected)
    if (!selectedLicense && licenses.length > 0) {
      allLicensesPollingRef.current = setInterval(() => {
        fetchAllLicensesTradeData();
      }, 3000); // Poll every 3 seconds
    }
    
    return () => {
      if (allLicensesPollingRef.current) {
        clearInterval(allLicensesPollingRef.current);
      }
    };
  }, [licenses, selectedLicense, user?.email]);

  useEffect(() => {
    setTradeData(null);
    setActionLogs([]);
    setLastUpdate(null);
    setEaConnected(false);
  }, [selectedLicense]);

  // Generate QR code when wallet address changes
  useEffect(() => {
    const selectedNetwork = paymentNetworks.find((n) => String(n.id) === String(selectedNetworkId));
    if (selectedNetwork?.wallet_address) {
      QRCode.toDataURL(selectedNetwork.wallet_address, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
        .then((url: string) => {
          setQrCodeDataUrl(url);
        })
        .catch((err: Error) => {
          console.error('QR Code generation error:', err);
          setQrCodeDataUrl('');
        });
    } else {
      setQrCodeDataUrl('');
    }
  }, [selectedNetworkId, paymentNetworks]);

  const selectedNetwork = paymentNetworks.find((n) => String(n.id) === String(selectedNetworkId));

  const pendingActivationCards = (purchaseRequests || [])
    .filter((r) => String(r.status || '').toLowerCase() === 'pending')
    .map((r) => ({
      _type: 'purchase_request',
      status: 'pending',
      license_key: `PENDING-${r.id}`,
      plan: typeof r.plan === 'string' ? r.plan : (r.plan?.name || '-'),
      mt5_account: r.mt5_account,
      created_at: r.created_at,
      request: r,
    }));

  const pendingPaymentRequests = (purchaseRequests || []).filter(
    (r) => String(r?.status || '').toLowerCase() === 'pending'
  );

  const fetchPaymentNetworks = async () => {
    try {
      const res = await fetch(`${API_URL}/payment-networks/`);
      const data = await res.json();
      if (data.success) {
        setPaymentNetworks(data.networks || []);
        if (!selectedNetworkId && data.networks?.length) {
          setSelectedNetworkId(String(data.networks[0].id));
        }
      }
    } catch (e) {
      console.error('Failed to fetch payment networks');
    }
  };

  const fetchPurchaseRequests = async () => {
    const identifier = user?.email || (user as any)?.username;
    if (!identifier) return;
    setLoadingRequests(true);
    try {
      const res = await fetch(`${API_URL}/license-purchase-requests/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier })
      });
      const data = await res.json();
      if (data.success) {
        const nextRequests = data.requests || [];
        setPurchaseRequests(nextRequests);

        // If admin approved and license key issued, refresh licenses so the card appears.
        try {
          const approvedKeys = (nextRequests || [])
            .filter((r: any) => String(r?.status || '').toLowerCase() === 'approved' && r?.issued_license_key)
            .map((r: any) => String(r.issued_license_key));

          const missing = approvedKeys.some((k: string) => !(licenses || []).some((l: any) => String(l?.license_key) === k));
          const now = Date.now();
          if (missing && now - lastAutoLicenseRefreshRef.current > 5000) {
            lastAutoLicenseRefreshRef.current = now;
            await refreshLicenses();
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.error('Failed to fetch purchase requests');
    } finally {
      setLoadingRequests(false);
    }
  };

  // Poll purchase requests when there is at least one pending item (so approvals show without manual refresh)
  useEffect(() => {
    const hasPending = (purchaseRequests || []).some((r: any) => String(r?.status || '').toLowerCase() === 'pending');
    const identifier = user?.email || (user as any)?.username;

    if (!identifier || !hasPending) {
      if (purchaseRequestsPollingRef.current) {
        clearInterval(purchaseRequestsPollingRef.current);
        purchaseRequestsPollingRef.current = null;
      }
      return;
    }

    if (!purchaseRequestsPollingRef.current) {
      purchaseRequestsPollingRef.current = setInterval(() => {
        fetchPurchaseRequests();
      }, 10000);
    }

    return () => {
      if (purchaseRequestsPollingRef.current) {
        clearInterval(purchaseRequestsPollingRef.current);
        purchaseRequestsPollingRef.current = null;
      }
    };
  }, [user?.email, (user as any)?.username, purchaseRequests]);
  
  const fetchAllLicensesTradeData = async () => {
    if (!licenses || licenses.length === 0) return;
    
    const dataMap: {[key: string]: any} = {};
    await Promise.all(licenses.map(async (lic) => {
      try {
        const res = await fetch(`${API_URL}/trade-data/?license_key=${lic.license_key}`);
        const data = await res.json();
        if (data.success && data.data) {
          dataMap[lic.license_key] = data.data;
        }
      } catch (e) {
        console.error('Failed to fetch trade data for', lic.license_key);
      }
    }));
    setAllTradeData(dataMap);
  };

  // Polling for trade data when license is selected
  useEffect(() => {
    const isPurchaseRequest = selectedLicense && selectedLicense._type === 'purchase_request';
    if (!selectedLicense || isPurchaseRequest || selectedLicense.status !== 'active') return;

    // Initial fetch
    fetchTradeData(selectedLicense.license_key);
    
    // Start polling
    pollingRef.current = setInterval(() => {
      if (isPolling) {
        fetchTradeData(selectedLicense.license_key);
      }
    }, POLLING_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [selectedLicense, isPolling]);

  const fetchTradeData = async (licenseKey: string) => {
    try {
      const res = await fetch(`${API_URL}/trade-data/?license_key=${licenseKey}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTradeData(data.data);
        setLastUpdate(new Date());
        // Check if EA is connected
        if (data.data.last_update) {
          const lastUpdated = new Date(data.data.last_update);
          const now = new Date();
          const diffSeconds = Math.abs(now.getTime() - lastUpdated.getTime()) / 1000;
          console.log('EA Connection Check:', { 
            lastUpdated: lastUpdated.toISOString(), 
            now: now.toISOString(), 
            diffSeconds, 
            connected: diffSeconds < EA_CONNECTED_TIMEOUT_SECONDS 
          });
          setEaConnected(diffSeconds < EA_CONNECTED_TIMEOUT_SECONDS);
        } else {
          // If we have recent data with symbol, assume connected
          const hasRecentData = data.data.symbol && (data.data.account_balance > 0 || data.data.total_buy_positions > 0 || data.data.total_sell_positions > 0);
          console.log('EA Connection Fallback:', { hasRecentData, symbol: data.data.symbol });
          setEaConnected(hasRecentData);
        }
      } else {
        setEaConnected(false);
      }
    } catch (e) {
      console.error('Failed to fetch trade data');
      setEaConnected(false);
    }
    fetchActionLogs(licenseKey);
  };

  const fetchActionLogs = async (licenseKey: string) => {
    try {
      const res = await fetch(`${API_URL}/action-logs/?license_key=${licenseKey}&limit=100`);
      const data = await res.json();
      if (data.success) {
        const isFirstLoad = actionLogs.length === 0;
        setActionLogs(data.logs);
        // Only scroll to bottom on first load, then let user scroll freely
        if (isFirstLoad) {
          setTimeout(() => {
            if (logContainerRef.current) {
              logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
            }
          }, 50);
        }
      }
    } catch (e) {
      console.error('Failed to fetch action logs');
    }
  };

  const fetchPlans = async () => {
    try {
      console.log('Fetching plans from:', `${API_URL}/plans/`);
      const res = await fetch(`${API_URL}/plans/`);
      const data = await res.json();
      console.log('Plans response:', data);
      if (data.success) {
        setPlans(data.plans);
      } else {
        console.error('Plans fetch failed:', data);
      }
    } catch (e) {
      console.error('Failed to fetch plans:', e);
    }
  };

  const handleExtendLicense = async (planId: number) => {
    if (!selectedLicense) return;
    
    setExtendingPlan(planId);
    try {
      console.log('Extending license:', selectedLicense.license_key, 'with plan:', planId);
      console.log('API URL:', `${API_URL}/extend-license/`);
      
      const response = await fetch(`${API_URL}/extend-license/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: selectedLicense.license_key,
          plan_id: planId
        })
      });
      
      const data = await response.json();
      console.log('Extend response:', data);
      
      if (data.success) {
        // Show success message
        const daysRemaining = data.license.days_remaining;
        const dayText = daysRemaining === 1 ? 'day' : 'days';
        alert(`✅ ${data.message}\nNew expiry: ${new Date(data.license.expires_at).toLocaleDateString()}\n${daysRemaining} ${dayText} remaining`);
        
        // Update selectedLicense with new data
        const updatedLicense = {
          ...selectedLicense,
          expires_at: data.license.expires_at,
          status: data.license.status
        };
        
        // Update the license in context
        selectLicense(updatedLicense);
        
        // Close modal
        setShowExtendModal(false);
      } else {
        alert('❌ ' + (data.message || 'Failed to extend license.'));
      }
    } catch (error: any) {
      console.error('Extend license error:', error);
      alert('❌ Failed to extend license. Please make sure the backend server is running and try again.');
    } finally {
      setExtendingPlan(null);
    }
  };

  const handleSelectLicense = (lic: any) => {
    selectLicense(lic);
  };

  const canGoToStep2 = !!selectedPlan && !!mt5Account.trim();

  const resetPurchaseForm = () => {
    setSelectedPlan(null);
    setMt5Account('');
    setTxid('');
    setUserNote('');
    setProofFile(null);
    setMessage({ type: '', text: '' });
    setPurchaseStep(1);
  };

  const renderActivationProgress = (req: any) => {
    const status = String(req?.status || '').toLowerCase();
    const isRejected = status === 'rejected';
    const isApproved = status === 'approved';
    const issuedKey = req?.issued_license_key;
    const isActivated = !!issuedKey && (licenses || []).some((l) => String(l.license_key) === String(issuedKey));

    const steps = [
      { id: 'submitted', label: 'Payment Submitted', done: true },
      { id: 'verification', label: isRejected ? 'Payment Rejected' : isApproved ? 'Payment Verified' : 'Payment Verification', done: isRejected || isApproved },
      { id: 'issued', label: 'License Issued', done: !!issuedKey },
      { id: 'activated', label: 'Activation Ready', done: isActivated },
    ];

    return (
      <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>License Activation Progress</p>
            <p className="text-gray-500 text-[11px] mt-0.5">We are verifying your payment and preparing your license.</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {steps.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                s.done ? 'bg-green-500/20 border-green-500/40' : 'bg-white/5 border-cyan-500/20'
              }`}>
                {s.done ? <Check className="w-3.5 h-3.5 text-green-300" /> : <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/40" />}
              </div>
              <div className="flex-1">
                <p className={`text-xs font-semibold ${s.done ? 'text-green-300' : isRejected ? 'text-red-300' : 'text-cyan-200'}`}>{s.label}</p>
              </div>
              {s.done ? <span className="text-[10px] text-gray-500">Done</span> : <span className="text-[10px] text-gray-600">Pending</span>}
            </div>
          ))}
        </div>

        {issuedKey ? (
          <div className="mt-4">
            <p className="text-[10px] text-gray-500 mb-1">Issued License Key</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-[10px] text-cyan-300 bg-black/40 px-2 py-1.5 rounded border border-cyan-500/20 truncate">{issuedKey}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(issuedKey)}
                className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30"
                title="Copy license key"
              >
                <Copy className="w-4 h-4 text-cyan-300" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const handlePurchase = async () => {
    if (!selectedPlan) {
      setMessage({ type: 'error', text: 'Please select a plan' });
      return;
    }
    if (!mt5Account.trim()) {
      setMessage({ type: 'error', text: 'Please enter MT5 account number' });
      return;
    }
    if (!selectedNetworkId) {
      setMessage({ type: 'error', text: 'Please select a payment network' });
      return;
    }
    if (!proofFile) {
      setMessage({ type: 'error', text: 'Please upload payment proof' });
      return;
    }

    setPurchasing(true);
    setMessage({ type: '', text: '' });

    try {
      const form = new FormData();
      form.append('email', user?.email || (user as any)?.username || '');
      const referralCode = (typeof window !== 'undefined' ? localStorage.getItem('referral_code') : null) || '';
      if (referralCode) {
        form.append('referral_code', referralCode);
      }
      form.append('plan_id', String(selectedPlan.id));
      form.append('network_id', String(selectedNetworkId));
      form.append('mt5_account', mt5Account.trim());
      form.append('txid', txid.trim());
      form.append('user_note', userNote.trim());
      form.append('proof', proofFile);

      const res = await fetch(`${API_URL}/license-purchase-requests/create/`, {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      if (data.success) {
        setPurchaseSuccess(data.request);
        setMessage({ type: 'success', text: data.message || 'Submitted. Pending approval.' });
        setTxid('');
        setUserNote('');
        setProofFile(null);
        setPurchaseStep(1);
        
        // Add new request to list immediately (normalize to match list endpoint shape)
        setPurchaseRequests((prev) => [
          {
            id: data.request?.id,
            request_number: data.request?.request_number,
            status: data.request?.status || 'pending',
            created_at: data.request?.created_at || new Date().toISOString(),
            reviewed_at: data.request?.reviewed_at || null,
            plan: (typeof data.request?.plan === 'string')
              ? data.request.plan
              : (data.request?.plan?.name || selectedPlan?.name || '-'),
            plan_id: data.request?.plan_id || selectedPlan?.id,
            amount_usd: (typeof data.request?.plan === 'object' && data.request?.plan?.price != null)
              ? data.request.plan.price
              : (data.request?.amount_usd ?? selectedPlan?.price),
            network: data.request?.network || {
              id: selectedNetwork?.id,
              name: selectedNetwork?.name || data.request?.payment?.network,
              code: selectedNetwork?.code,
              token_symbol: selectedNetwork?.token_symbol || data.request?.payment?.token_symbol,
              wallet_address: selectedNetwork?.wallet_address,
            },
            mt5_account: data.request?.mt5_account ?? mt5Account.trim(),
            txid: data.request?.payment?.txid ?? txid.trim(),
            user_note: userNote.trim(),
            admin_note: null,
            proof_url: data.request?.payment?.proof_url,
            issued_license_key: data.request?.issued_license_key || null,
          },
          ...(prev || []),
        ]);
        
        // Also refresh from server to ensure sync
        await fetchPurchaseRequests();
      } else {
        setMessage({ type: 'error', text: data.message || 'Submission failed' });
      }
    } catch (e) {
      console.error('Purchase request error:', e);
      setMessage({ type: 'error', text: 'Connection error. Please try again.' });
    } finally {
      setPurchasing(false);
    }
  };

  const getDaysRemaining = (lic: any) => {
    if (!lic?.expires_at) return 0;
    const expires = new Date(lic.expires_at);
    const diff = expires.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // If license selected, show dashboard with trading
  if (selectedLicense) {
    const isPurchaseRequest = selectedLicense._type === 'purchase_request';
    const isActive = !isPurchaseRequest && selectedLicense.status === 'active';
    const isExpiredLicense = !isPurchaseRequest && (
      String(selectedLicense.status || '').toLowerCase() === 'expired' || getDaysRemaining(selectedLicense) <= 0
    );

    if (!isActive) {
      const request = isPurchaseRequest ? selectedLicense.request : null;
      return (
        <div className="max-w-7xl mx-auto pt-3 sm:pt-5 px-0.5 sm:px-4 pb-6 sm:pb-8">
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    {isPurchaseRequest ? 'PENDING ACTIVATION' : String(selectedLicense.status || 'INACTIVE').toUpperCase()}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {isPurchaseRequest
                      ? 'Your purchase is under verification. Once approved, your license will be activated.'
                      : isExpiredLicense
                        ? 'Your license has expired. Extend now to continue trading.'
                        : 'This license is not active. Trading dashboard is unavailable.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isExpiredLicense ? (
                    <button
                      type="button"
                      onClick={() => setShowExtendModal(true)}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      Extend
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => clearSelectedLicense()}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Back
                  </button>
                </div>
              </div>

              {isPurchaseRequest ? (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-[#0a0a0f] border border-cyan-500/10 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500">Request</p>
                      <p className="text-sm text-white font-mono">#{request?.id}</p>
                    </div>
                    <div className="bg-[#0a0a0f] border border-cyan-500/10 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500">Plan</p>
                      <p className="text-sm text-white">{typeof request?.plan === 'string' ? request?.plan : (request?.plan?.name || '-')}</p>
                    </div>
                    <div className="bg-[#0a0a0f] border border-cyan-500/10 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500">Status</p>
                      <p className="text-sm font-bold text-yellow-300">{String(request?.status || '').toUpperCase()}</p>
                    </div>
                  </div>

                  {renderActivationProgress(request)}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setRefreshing(true);
                        try {
                          await fetchPurchaseRequests();
                          await refreshLicenses();
                        } finally {
                          setRefreshing(false);
                        }
                      }}
                      disabled={refreshing}
                      className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-black px-4 py-2 rounded-lg font-bold text-xs"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing...' : 'Refresh Status'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (request?.issued_license_key) {
                          navigator.clipboard.writeText(request.issued_license_key);
                        }
                      }}
                      disabled={!request?.issued_license_key}
                      className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-300 border border-cyan-500/30 px-4 py-2 rounded-lg font-bold text-xs"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      <Copy className="w-4 h-4" /> Copy License Key
                    </button>
                  </div>
                </div>
              ) : null}

              {isExpiredLicense && showExtendModal ? (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl p-6 w-full max-w-xl border border-purple-500/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-cyan-400" />
                        <h2 className="text-lg sm:text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Extend Your License</h2>
                      </div>
                      <button
                        onClick={() => setShowExtendModal(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {plans.map((plan: any) => (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => handleExtendLicense(plan.id)}
                          disabled={extendingPlan === plan.id}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="text-left">
                            <p className="text-white font-bold text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>{plan.name}</p>
                            <p className="text-gray-400 text-xs">{plan.duration_days} days</p>
                          </div>
                          <div className="text-right">
                            <p className="text-cyan-300 font-bold">${plan.price}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    const isRecoveryModeDetails = tradeData?.trading_mode?.toLowerCase().includes('recovery');
    return (
      <div className="max-w-7xl mx-auto pt-3 sm:pt-5 px-0.5 sm:px-4 pb-6 sm:pb-8">
        <div className="space-y-3 sm:space-y-4">
          {/* License Expiry Warning Banner */}
          {isActive && getDaysRemaining(selectedLicense) <= 7 && (
            <div className={`rounded-lg px-3 sm:px-4 py-2 sm:py-3 border ${
              getDaysRemaining(selectedLicense) <= 0 
                ? 'bg-red-500/10 border-red-500/30' 
                : getDaysRemaining(selectedLicense) <= 3 
                  ? 'bg-orange-500/10 border-orange-500/30' 
                  : 'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-lg sm:text-xl">
                    {getDaysRemaining(selectedLicense) <= 0 
                      ? '🚨' 
                      : getDaysRemaining(selectedLicense) <= 3 
                        ? '⚠️' 
                        : '⏰'}
                  </span>
                  <div>
                    <p className={`font-bold text-sm sm:text-base ${
                      getDaysRemaining(selectedLicense) <= 0 
                        ? 'text-red-400' 
                        : getDaysRemaining(selectedLicense) <= 3 
                          ? 'text-orange-400' 
                          : 'text-yellow-400'
                    }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {getDaysRemaining(selectedLicense) <= 0 
                        ? 'LICENSE EXPIRED!' 
                        : `LICENSE EXPIRES IN ${getDaysRemaining(selectedLicense)} ${getDaysRemaining(selectedLicense) === 1 ? 'DAY' : 'DAYS'}`}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400">
                      {getDaysRemaining(selectedLicense) <= 0 
                        ? 'Your license has expired. Click below to extend now.' 
                        : 'Extend your license to avoid any trading interruption.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExtendModal(true)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                    getDaysRemaining(selectedLicense) <= 0 
                      ? 'bg-red-500 hover:bg-red-400 text-white' 
                      : getDaysRemaining(selectedLicense) <= 3 
                        ? 'bg-orange-500 hover:bg-orange-400 text-white' 
                        : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                  }`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  EXTEND NOW
                </button>
              </div>
            </div>
          )}

          {/* Compact Header Bar */}
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg px-2 sm:px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={() => setIsPolling(!isPolling)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-xs font-medium ${
                  isPolling ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-400'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-black animate-pulse' : 'bg-gray-500'}`}></span>
                {isPolling ? 'LIVE' : 'PAUSED'}
              </button>
              {eaConnected && tradeData?.trading_mode ? (
                <span className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium border ${
                  isRecoveryModeDetails 
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                    : 'bg-green-500/20 text-green-400 border-green-500/30'
                }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <svg 
                    className="w-3 h-3 sm:w-3.5 sm:h-3.5"
                    style={{ animation: isRecoveryModeDetails ? 'spin 0.5s linear infinite' : 'spin 3s linear infinite' }}
                    viewBox="0 0 24 24" 
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <circle cx="12" cy="4" r="2" fill="currentColor" />
                  </svg>
                  {tradeData?.trading_mode === 'Normal' ? 'Normal Mode Running' : (tradeData?.trading_mode || 'Normal Mode Running')}
                </span>
              ) : !eaConnected && (
                <span className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium border bg-gray-500/20 text-gray-400 border-gray-500/30" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                    <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                  </svg>
                  Terminal Offline
                </span>
              )}
              <span className="text-[10px] sm:text-xs text-gray-500">
                {lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--:--'}
              </span>
            </div>
          </div>

          {/* EA Connection Status Banner + Trading Log */}
          <div className={`rounded-xl overflow-hidden border ${eaConnected ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/10 border-cyan-500/30' : 'bg-[#12121a] border-gray-700'}`}>
            {/* Status Header */}
            <div className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${eaConnected ? 'bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50' : 'bg-gray-600'}`}></div>
                  <div>
                    <p className="font-bold text-white text-sm sm:text-base" style={{ fontFamily: 'Orbitron, sans-serif' }}>{eaConnected ? 'AI CONNECTED' : 'AI DISCONNECTED'}</p>
                    <p className="text-xs sm:text-sm text-gray-400">
                      {eaConnected 
                        ? `${tradeData?.symbol || 'N/A'} @ ${tradeData?.current_price || '-'}`
                        : 'Waiting for AI...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-6">
                  <div className="text-center">
                    <p className="text-lg sm:text-2xl font-bold text-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>{tradeData?.total_pending_orders || 0}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg sm:text-2xl font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>{(tradeData?.total_buy_positions || 0) + (tradeData?.total_sell_positions || 0)}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Open</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Trading Log (inside banner) */}
            <div className="bg-[#0a0a0f] border-t border-cyan-500/10">
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-cyan-500/10">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 text-xs" style={{ fontFamily: 'Orbitron, sans-serif' }}>TRADING LOG</span>
                  <span className="text-gray-700 text-xs">|</span>
                  <span className="text-yellow-400 text-xs font-mono">{tradeData?.symbol || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActionLogs([])}
                    className="text-gray-600 hover:text-red-400 text-xs font-mono px-1.5 py-0.5 hover:bg-gray-800 rounded"
                  >
                    Clear
                  </button>
                  <span className={`w-1.5 h-1.5 rounded-full ${isPolling ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`}></span>
                </div>
              </div>
              <div 
                ref={logContainerRef}
                className="overflow-y-auto overflow-x-auto p-2 font-mono text-xs leading-relaxed"
                style={{ scrollbarWidth: 'thin', height: '220px' }}
              >
                {(() => {
                  const relevantTypes = ['OPEN', 'OPEN_BUY', 'OPEN_SELL', 'CLOSE', 'CLOSE_BUY', 'CLOSE_SELL', 
                                         'MODIFY', 'TRAILING', 'RECOVERY', 'MODE', 'MODE_CHANGE', 'GRID', 'BREAKEVEN'];
                  const filteredLogs = actionLogs
                    .filter((log: any) => relevantTypes.includes(log.type))
                    .slice(-100);
                  
                  if (filteredLogs.length === 0) {
                    return (
                      <div className="text-center py-4">
                        <p className="text-gray-500 text-xs">Waiting for trading activity...</p>
                      </div>
                    );
                  }
                  
                  return filteredLogs.map((log: any, i: number) => (
                    <div key={i} className="flex gap-2 py-0.5 border-l-2 pl-2 mb-0.5 min-w-max" style={{
                      borderColor: 
                        log.type === 'OPEN_BUY' ? '#22c55e' :
                        log.type === 'OPEN_SELL' ? '#ef4444' :
                        log.type === 'TRAILING' ? '#f59e0b' :
                        log.type === 'MODE_CHANGE' ? '#8b5cf6' :
                        '#374151'
                    }}>
                      <span className="text-gray-600 w-14 flex-shrink-0">{log.time}</span>
                      <span className={`w-20 flex-shrink-0 font-bold text-[10px] ${
                        log.type === 'OPEN_BUY' ? 'text-green-400' :
                        log.type === 'OPEN_SELL' ? 'text-red-400' :
                        log.type === 'TRAILING' ? 'text-amber-400' :
                        log.type === 'MODE_CHANGE' ? 'text-purple-400' :
                        'text-gray-400'
                      }`}>{log.type}</span>
                      <span className="text-gray-300 whitespace-nowrap">{log.message}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Compact Stats Row */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">Balance</p>
              <p className="text-xs sm:text-sm font-bold text-white">${tradeData?.account_balance?.toLocaleString() || '-'}</p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">Equity</p>
              <p className="text-xs sm:text-sm font-bold text-white">${tradeData?.account_equity?.toLocaleString() || '-'}</p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">P/L</p>
              <p className={`text-xs sm:text-sm font-bold ${(tradeData?.account_profit || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                {(tradeData?.account_profit || 0) >= 0 ? '+' : ''}${tradeData?.account_profit?.toFixed(0) || '0'}
              </p>
            </div>
            <div className="bg-[#12121a] border border-yellow-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">Expires</p>
              <p className="text-xs sm:text-sm font-bold text-yellow-400">{getDaysRemaining(selectedLicense)} {getDaysRemaining(selectedLicense) === 1 ? 'day' : 'days'}</p>
            </div>
          </div>
          {/* Second Stats Row - Desktop only or collapsible */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">BUY</p>
              <p className="text-xs sm:text-sm font-bold text-green-400">{tradeData?.total_buy_positions || 0} <span className="text-[10px] sm:text-xs font-normal text-gray-600">({tradeData?.total_buy_lots?.toFixed(2) || '0'})</span></p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">SELL</p>
              <p className="text-xs sm:text-sm font-bold text-red-400">{tradeData?.total_sell_positions || 0} <span className="text-[10px] sm:text-xs font-normal text-gray-600">({tradeData?.total_sell_lots?.toFixed(2) || '0'})</span></p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">BUY P/L</p>
              <p className={`text-xs sm:text-sm font-bold ${(tradeData?.total_buy_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${tradeData?.total_buy_profit?.toFixed(0) || '0'}
              </p>
            </div>
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-2">
              <p className="text-gray-500 text-[10px] sm:text-xs">SELL P/L</p>
              <p className={`text-xs sm:text-sm font-bold ${(tradeData?.total_sell_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${tradeData?.total_sell_profit?.toFixed(0) || '0'}
              </p>
            </div>
          </div>

          {/* Positions Tabs (Open & Closed) */}
          {tradeData && (
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl overflow-hidden">
              {/* Tab Headers */}
              <div className="flex border-b border-cyan-500/10">
                <button
                  onClick={() => setPositionsTab('open')}
                  className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all ${
                    positionsTab === 'open'
                      ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  OPEN POSITIONS
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                    positionsTab === 'open' ? 'bg-cyan-500/30' : 'bg-gray-700'
                  }`}>
                    {tradeData.open_positions?.length || 0}
                  </span>
                </button>
                <button
                  onClick={() => setPositionsTab('closed')}
                  className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all ${
                    positionsTab === 'closed'
                      ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-400'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  CLOSED
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                    positionsTab === 'closed' ? 'bg-purple-500/30' : 'bg-gray-700'
                  }`}>
                    {tradeData.closed_positions?.length || 0}
                  </span>
                </button>
              </div>

              {/* Open Positions Tab Content */}
              {positionsTab === 'open' && (
                <>
                  <div className="p-2 border-b border-cyan-500/10 flex justify-end">
                    <span className="text-[10px] sm:text-xs text-cyan-400">{tradeData.symbol} @ {tradeData.current_price}</span>
                  </div>
                  {tradeData.open_positions?.length > 0 ? (
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full text-[10px] sm:text-sm">
                        <thead className="bg-[#0a0a0f] sticky top-0">
                          <tr>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Ticket</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Symbol</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Type</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">Lots</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">Open</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:table-cell">SL</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:table-cell">TP</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">P/L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {tradeData.open_positions.map((pos: any, i: number) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 font-mono text-[10px] sm:text-xs text-gray-400">{pos.ticket}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-yellow-400 font-medium">{pos.symbol || tradeData.symbol}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2">
                                <span className={`px-1 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${
                                  pos.type === 'BUY' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}>
                                  {pos.type}
                                </span>
                              </td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-gray-300">{pos.lots}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-mono text-gray-300">{pos.open_price}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-mono text-red-400 hidden sm:table-cell">{pos.sl || '-'}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-mono text-green-400 hidden sm:table-cell">{pos.tp || '-'}</td>
                              <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-bold ${
                                pos.profit >= 0 ? 'text-cyan-400' : 'text-red-400'
                              }`}>
                                {pos.profit >= 0 ? '+' : ''}{pos.profit?.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 text-center text-gray-500 text-xs sm:text-sm">
                      No open positions
                    </div>
                  )}
                </>
              )}

              {/* Closed Positions Tab Content */}
              {positionsTab === 'closed' && (
                <>
                  {tradeData.closed_positions?.length > 0 ? (
                    <div ref={closedPositionsRef} className="overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full text-[10px] sm:text-sm">
                        <thead className="bg-[#0a0a0f] sticky top-0 z-10">
                          <tr>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Ticket</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Symbol</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs font-medium text-gray-500">Type</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">Lots</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:table-cell">Open</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:table-cell">Close</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">Profit</th>
                            <th className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden md:table-cell">Close Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {[...tradeData.closed_positions]
                            .sort((a: any, b: any) => {
                              // Sort by close_time descending (most recent first)
                              const timeA = a.close_time ? new Date(a.close_time).getTime() : 0;
                              const timeB = b.close_time ? new Date(b.close_time).getTime() : 0;
                              return timeB - timeA;
                            })
                            .slice(0, 100)
                            .map((pos: any, idx: number) => (
                            <tr key={pos.ticket || idx} className="hover:bg-white/5">
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 font-mono text-[10px] sm:text-xs text-gray-400">{pos.ticket}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-yellow-400 font-medium">{pos.symbol || '-'}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2">
                                <span className={`px-1 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${
                                  pos.type?.toLowerCase().includes('buy') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}>
                                  {pos.type}
                                </span>
                              </td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-gray-300">{pos.lots?.toFixed(2)}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-mono text-gray-300 hidden sm:table-cell">{pos.open_price?.toFixed(2)}</td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-mono text-gray-300 hidden sm:table-cell">{pos.close_price?.toFixed(2)}</td>
                              <td className={`px-1.5 sm:px-3 py-1.5 sm:py-2 text-right font-bold ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pos.profit >= 0 ? '+' : ''}${pos.profit?.toFixed(2)}
                              </td>
                              <td className="px-1.5 sm:px-3 py-1.5 sm:py-2 text-right text-gray-500 hidden md:table-cell text-[10px]">{pos.close_time || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {tradeData.closed_positions.length > 100 && (
                        <div className="p-2 text-center text-purple-400/70 text-xs border-t border-purple-500/10">
                          Showing 100 of {tradeData.closed_positions.length} closed positions
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 text-center text-gray-500 text-xs sm:text-sm">
                      No closed positions yet
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Pending Orders Table */}
          {tradeData && (
            <div className="bg-[#12121a] border border-yellow-500/20 rounded-lg overflow-hidden">
              <div className="p-2 border-b border-yellow-500/10 flex justify-between items-center">
                <h3 className="font-semibold text-yellow-400 text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>PENDING ORDERS</h3>
                <span className="text-[10px] sm:text-xs text-yellow-400/70">{tradeData.pending_orders?.length || 0} orders</span>
              </div>
              {tradeData.pending_orders?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] sm:text-xs">
                    <thead className="bg-[#0a0a0f]">
                      <tr>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500">Ticket</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500">Symbol</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-left text-[10px] sm:text-xs font-medium text-gray-500">Type</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right text-[10px] sm:text-xs font-medium text-gray-500">Lots</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right text-[10px] sm:text-xs font-medium text-gray-500">Price</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:table-cell">SL</th>
                        <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right text-[10px] sm:text-xs font-medium text-gray-500">TP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {tradeData.pending_orders?.map((order: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 font-mono text-gray-400">{order.ticket}</td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-[10px] sm:text-xs text-yellow-400 font-medium">{order.symbol || tradeData.symbol}</td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5">
                            <span className={`px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold ${
                              order.type?.includes('BUY') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              <span className="hidden sm:inline">{order.type?.replace('_', ' ')}</span>
                              <span className="sm:hidden">{order.type?.includes('BUY') ? 'BUY' : 'SELL'}</span>
                            </span>
                          </td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right text-gray-300">{order.lots}</td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right font-mono text-gray-300">{order.price}</td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right font-mono text-red-400 hidden sm:table-cell">{order.sl || '-'}</td>
                          <td className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-right font-mono text-green-400">{order.tp || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-2 sm:p-3 text-center text-gray-500 text-xs sm:text-sm">
                  No pending orders
                </div>
              )}
            </div>
          )}

          {/* License Info (always visible) */}
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl overflow-hidden">
            <div className="p-3 sm:p-4 font-bold text-white text-xs sm:text-sm border-b border-cyan-500/10" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              LICENSE DETAILS
            </div>
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-cyan-500/10">
              <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4">
                {/* License Key */}
                <div>
                  <p className="text-gray-500 text-[10px] sm:text-xs mb-1.5">License Key</p>
                  <div className="flex items-start sm:items-center gap-2">
                    <p className="font-mono text-[10px] sm:text-xs bg-[#0a0a0f] text-cyan-400 p-2 sm:p-2.5 rounded-lg border border-cyan-500/20 break-all flex-1 leading-relaxed">{selectedLicense.license_key}</p>
                    <button
                      onClick={(e) => {
                        navigator.clipboard.writeText(selectedLicense.license_key);
                        const btn = e.currentTarget;
                        btn.classList.add('copied');
                        setTimeout(() => btn.classList.remove('copied'), 1500);
                      }}
                      className="group flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-2.5 py-1.5 sm:py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all whitespace-nowrap border border-cyan-500/30 [&.copied]:bg-green-500/20 [&.copied]:text-green-400 [&.copied]:border-green-500/30"
                    >
                      <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-[.copied]:hidden" />
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden group-[.copied]:block" />
                      <span className="group-[.copied]:hidden">Copy</span>
                      <span className="hidden group-[.copied]:inline">Copied</span>
                    </button>
                  </div>
                </div>
                
                {/* MT5 Account & Expires - Side by side */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-[#0a0a0f]/50 rounded-lg p-2.5 sm:p-3 border border-cyan-500/10">
                    <p className="text-gray-500 text-[10px] sm:text-xs mb-1">MT5 Account</p>
                    <p className="font-semibold text-white text-sm sm:text-base">{selectedLicense.mt5_account || 'Not Set'}</p>
                  </div>
                  <div className={`bg-[#0a0a0f]/50 rounded-lg p-2.5 sm:p-3 border ${getDaysRemaining(selectedLicense) <= 0 ? 'border-red-500/30' : getDaysRemaining(selectedLicense) <= 3 ? 'border-yellow-500/30' : 'border-cyan-500/10'}`}>
                    <p className="text-gray-500 text-[10px] sm:text-xs mb-1">Expires</p>
                    <p className="font-semibold text-white text-sm sm:text-base">
                      {selectedLicense.expires_at ? new Date(selectedLicense.expires_at).toLocaleDateString() : '-'}
                    </p>
                    <p className={`text-[10px] sm:text-xs mt-0.5 ${getDaysRemaining(selectedLicense) <= 0 ? 'text-red-400' : getDaysRemaining(selectedLicense) <= 3 ? 'text-yellow-400' : 'text-yellow-400'}`}>
                      {getDaysRemaining(selectedLicense) <= 0 ? 'Expired!' : `(${getDaysRemaining(selectedLicense)} ${getDaysRemaining(selectedLicense) === 1 ? 'day' : 'days'} left)`}
                    </p>
                  </div>
                </div>
                
                {/* Extend Subscription - Show when expired or about to expire */}
                {getDaysRemaining(selectedLicense) <= 7 && (
                  <div className={`rounded-lg p-3 sm:p-4 border ${
                    getDaysRemaining(selectedLicense) <= 0 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : getDaysRemaining(selectedLicense) <= 3 
                        ? 'bg-orange-500/10 border-orange-500/30' 
                        : 'bg-yellow-500/10 border-yellow-500/30'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className={`font-semibold text-sm sm:text-base ${
                          getDaysRemaining(selectedLicense) <= 0 
                            ? 'text-red-400' 
                            : getDaysRemaining(selectedLicense) <= 3 
                              ? 'text-orange-400' 
                              : 'text-yellow-400'
                        }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                          {getDaysRemaining(selectedLicense) <= 0 
                            ? '🚨 License Expired!' 
                            : getDaysRemaining(selectedLicense) <= 3 
                              ? '⚠️ License Expiring Soon!' 
                              : '⏰ License Expiring in 7 Days!'}
                        </p>
                        <p className="text-gray-400 text-[10px] sm:text-xs mt-1">
                          {getDaysRemaining(selectedLicense) <= 0 
                            ? 'Your license has expired. Extend now to continue trading.' 
                            : getDaysRemaining(selectedLicense) <= 3 
                              ? `Only ${getDaysRemaining(selectedLicense)} ${getDaysRemaining(selectedLicense) === 1 ? 'day' : 'days'} remaining. Extend to avoid interruption.`
                              : `Your license expires in ${getDaysRemaining(selectedLicense)} ${getDaysRemaining(selectedLicense) === 1 ? 'day' : 'days'}. Extend now to avoid any interruption.`}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowExtendModal(true)}
                        className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                          getDaysRemaining(selectedLicense) <= 0 
                            ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white shadow-lg shadow-red-500/20' 
                            : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black shadow-lg shadow-yellow-500/20'
                        }`}
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        <Sparkles className="w-4 h-4" />
                        EXTEND LICENSE
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Extend License Modal */}
        {showExtendModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className={`bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl p-6 w-full max-h-[90vh] overflow-y-auto border border-purple-500/30 ${
              plans.length === 1 ? 'max-w-md' : plans.length === 2 ? 'max-w-2xl' : 'max-w-4xl'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                  <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Extend Your License</h2>
                </div>
                <button
                  onClick={() => setShowExtendModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className={`grid gap-6 ${
                plans.length === 1 ? 'grid-cols-1' : 
                plans.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 
                'grid-cols-1 md:grid-cols-3'
              }`}>
                {plans.map((plan: any, index: number) => (
                  <div
                    key={plan.id}
                    className={`relative bg-gradient-to-br from-white/5 to-transparent backdrop-blur-lg rounded-xl p-6 border transition-all hover:scale-105 ${
                      index === 1
                        ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/10'
                        : 'border-cyan-500/20 hover:border-cyan-500/40'
                    }`}
                  >
                    {index === 1 && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-cyan-500 to-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">
                          MOST POPULAR
                        </span>
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-white mb-2 text-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {plan.name}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4 text-center">
                      {plan.description}
                    </p>
                    <div className="mb-6 text-center">
                      <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                        ${plan.price}
                      </span>
                      <span className="text-gray-500 text-sm">
                        /{plan.duration_days} days
                      </span>
                    </div>
                    <ul className="space-y-2 mb-6">
                      <li className="flex items-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        {plan.max_accounts} MT5 Account{plan.max_accounts > 1 ? 's' : ''}
                      </li>
                      <li className="flex items-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        AI-Powered Trading
                      </li>
                      <li className="flex items-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        24/7 Support
                      </li>
                      <li className="flex items-center gap-2 text-gray-300 text-sm">
                        <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        Regular Updates
                      </li>
                    </ul>
                    <button
                      onClick={() => handleExtendLicense(plan.id)}
                      disabled={extendingPlan === plan.id}
                      className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                        index === 1
                          ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 text-black shadow-lg shadow-cyan-500/25'
                          : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {extendingPlan === plan.id ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>Extend Now</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // License Selection Screen
  return (
    <div className="max-w-3xl mx-auto px-1 sm:px-4 py-4 sm:py-8">
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Welcome,</h2>
        <h2 className="text-sm sm:text-xl font-bold text-cyan-400 mb-1 break-all px-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>{user?.name || user?.email}</h2>
        <p className="text-gray-500 text-xs sm:text-sm">Select a license to access your AI trading dashboard</p>
      </div>

      {/* Purchase New License Section - Now at top */}
      <details className="bg-[#12121a] border border-cyan-500/20 rounded-xl mb-4 sm:mb-6 overflow-hidden" open={licenses.length === 0}>
        <summary className="p-3 sm:p-4 cursor-pointer font-semibold text-white hover:bg-white/5 rounded-xl flex items-center justify-between gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 text-lg">+</span>
            <span className="text-xs sm:text-sm">PURCHASE NEW LICENSE</span>
          </div>
          <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">Click to expand</span>
        </summary>
        <div className="px-3 sm:px-4 pb-4 border-t border-cyan-500/10">
          {purchaseSuccess ? (
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-base sm:text-lg font-bold text-cyan-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    Submitted Successfully
                  </h4>
                  <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
                    Your payment proof has been submitted. Status: <span className="text-yellow-300 font-semibold">PENDING</span>
                  </p>

                  <div className="mt-3">
                    {renderActivationProgress(purchaseSuccess)}
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500">Request ID</p>
                      <p className="text-sm text-white font-mono">#{purchaseSuccess.request_number || purchaseSuccess.id}</p>
                    </div>
                    <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500">Amount</p>
                      <p className="text-sm text-yellow-300 font-bold">${purchaseSuccess.plan?.price || purchaseSuccess.amount_usd} {purchaseSuccess.payment?.token_symbol}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={async () => {
                        setRefreshing(true);
                        try {
                          await fetchPurchaseRequests();
                          await refreshLicenses();
                        } finally {
                          setRefreshing(false);
                        }
                      }}
                      disabled={refreshing}
                      className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-black px-4 py-2 rounded-lg font-bold text-xs sm:text-sm"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing...' : 'Refresh Status'}
                    </button>
                    <button
                      onClick={() => {
                        setPurchaseSuccess(null);
                        resetPurchaseForm();
                      }}
                      className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 px-4 py-2 rounded-lg font-bold text-xs sm:text-sm"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      Submit Another
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-4">
              <div className="mb-4 bg-[#0a0a0f] border border-cyan-500/10 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Step {purchaseStep} / 2</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetPurchaseForm();
                      }}
                      className="text-[10px] text-gray-500 hover:text-cyan-300"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Step 1: Plan & MT5 • Step 2: Payment Details</p>
              </div>

              {plans.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm">Loading plans...</p>
                  <button 
                    onClick={fetchPlans}
                    className="mt-2 text-cyan-400 text-sm hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mb-4">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-2 sm:p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                        selectedPlan?.id === plan.id
                          ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                          : 'border-gray-700 hover:border-cyan-500/50 bg-[#0a0a0f]'
                      }`}
                    >
                      <h4 className="font-semibold text-white text-[10px] sm:text-sm truncate" style={{ fontFamily: 'Orbitron, sans-serif' }}>{plan.name}</h4>
                      <p className="text-sm sm:text-xl font-bold text-cyan-400 my-0.5" style={{ fontFamily: 'Orbitron, sans-serif' }}>${plan.price}</p>
                      <p className="text-[9px] sm:text-xs text-gray-500">{plan.duration_days} days</p>
                    </div>
                  ))}
                </div>
              )}
              
              {plans.length > 0 && purchaseStep === 1 ? (
                <>
                  <div className="mb-3">
                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">MT5 Account Number</label>
                    <input
                      type="text"
                      value={mt5Account}
                      onChange={(e) => setMt5Account(e.target.value)}
                      placeholder="Enter MT5 account"
                      className="w-full px-3 py-2 sm:py-2.5 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-xs sm:text-sm text-white placeholder-gray-600"
                    />
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1">License will be bound to this account only</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPurchaseStep(2)}
                    disabled={!canGoToStep2}
                    className="w-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-700 disabled:to-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed text-black py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:shadow-none"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    NEXT: PAYMENT DETAILS
                  </button>
                </>
              ) : null}

              {plans.length > 0 && purchaseStep === 2 ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPurchaseStep(1)}
                      className="text-cyan-300 hover:text-cyan-200 text-xs font-medium"
                    >
                      ← Back
                    </button>
                    <p className="text-[10px] text-gray-600">Review wallet, upload proof, submit</p>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Payment Network</label>
                    <select
                      value={selectedNetworkId}
                      onChange={(e) => setSelectedNetworkId(e.target.value)}
                      className="w-full px-3 py-2 sm:py-2.5 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-xs sm:text-sm text-white"
                    >
                      <option value="" disabled>Select network</option>
                      {paymentNetworks.map((n) => (
                        <option key={n.id} value={String(n.id)}>
                          {n.name} ({n.token_symbol})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Wallet address is set from backend/admin</p>
                  </div>

                  {selectedPlan && selectedNetwork ? (
                    <div className="mb-3 bg-[#0a0a0f] border border-cyan-500/20 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Wallet className="w-4 h-4 text-yellow-400" />
                            <p className="text-xs text-gray-400">Send exactly</p>
                          </div>
                          <p className="text-lg font-bold text-yellow-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                            ${selectedPlan.price} {selectedNetwork.token_symbol}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-1">To wallet ({selectedNetwork.name})</p>
                          <div className="mt-2 flex items-center gap-2">
                            <code className="flex-1 font-mono text-[10px] sm:text-xs text-cyan-300 bg-black/40 px-2 py-2 rounded border border-cyan-500/20 break-all">
                              {selectedNetwork.wallet_address}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedNetwork.wallet_address);
                                setWalletCopied(true);
                                setTimeout(() => setWalletCopied(false), 2000);
                              }}
                              className={`p-2 rounded-lg border transition-all duration-300 ${walletCopied ? 'bg-green-500/20 border-green-500/50' : 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30'}`}
                              title={walletCopied ? 'Copied!' : 'Copy wallet'}
                            >
                              {walletCopied ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4 text-cyan-300" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-lg p-2 flex items-center justify-center flex-shrink-0">
                          {qrCodeDataUrl ? (
                            <img
                              alt="Wallet QR"
                              className="w-full h-full object-contain"
                              src={qrCodeDataUrl}
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-gray-400 text-xs">
                              Loading QR...
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">After sending funds, upload proof and submit for admin approval.</p>
                    </div>
                  ) : null}

                  <div className="mb-3">
                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Transaction ID (optional)</label>
                    <input
                      type="text"
                      value={txid}
                      onChange={(e) => setTxid(e.target.value)}
                      placeholder="Paste TXID / Hash"
                      className="w-full px-3 py-2 sm:py-2.5 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-xs sm:text-sm text-white placeholder-gray-600"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Payment Proof (required)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="proofUpload"
                      />
                      <label
                        htmlFor="proofUpload"
                        className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 px-4 py-2 rounded-lg font-bold text-xs sm:text-sm"
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        <Upload className="w-4 h-4" /> {proofFile ? 'Change Proof File' : 'Upload Proof'}
                      </label>
                      {proofFile ? (
                        <span className="text-[10px] sm:text-xs text-gray-400 truncate max-w-[140px]">{proofFile.name}</span>
                      ) : null}
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Screenshot / PDF of transfer confirmation</p>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Note (optional)</label>
                    <textarea
                      value={userNote}
                      onChange={(e) => setUserNote(e.target.value)}
                      placeholder="Any note for admin (optional)"
                      rows={2}
                      className="w-full px-3 py-2 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-xs sm:text-sm text-white placeholder-gray-600"
                    />
                  </div>

                  {message.type === 'error' && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs sm:text-sm mb-3">
                      {message.text}
                    </div>
                  )}

                  {message.type === 'success' && (
                    <div className="bg-green-500/10 border border-green-500/30 text-green-300 px-3 py-2 rounded-lg text-xs sm:text-sm mb-3">
                      {message.text}
                    </div>
                  )}

                  <button
                    onClick={handlePurchase}
                    disabled={purchasing || !selectedPlan || !mt5Account.trim() || !selectedNetworkId || !proofFile}
                    className="w-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-700 disabled:to-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed text-black py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:shadow-none"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    {purchasing ? 'SUBMITTING...' : 'SUBMIT PAYMENT PROOF'}
                  </button>
                </>
              ) : null}

              <div className="mt-4 border-t border-cyan-500/10 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs sm:text-sm font-semibold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>MY PAYMENT REQUESTS</p>
                      <button
                        onClick={async () => {
                          setRefreshing(true);
                          try {
                            await fetchPurchaseRequests();
                            await refreshLicenses();
                          } finally {
                            setRefreshing(false);
                          }
                        }}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>

                    {loadingRequests ? (
                      <div className="text-gray-500 text-xs">Loading requests...</div>
                    ) : pendingPaymentRequests.length === 0 ? (
                      <div className="text-gray-600 text-xs">No pending requests.</div>
                    ) : (
                      <div className="space-y-2">
                        {pendingPaymentRequests.slice(0, 5).map((r) => (
                          <div key={r.id} className="bg-black/30 border border-cyan-500/10 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-white text-xs font-semibold">#{r.request_number || r.id} • {r.plan} • ${r.amount_usd}</p>
                                <p className="text-gray-500 text-[10px]">{r.network?.name} • {new Date(r.created_at).toLocaleString()}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                                r.status === 'approved'
                                  ? 'bg-green-500/10 text-green-300 border-green-500/30'
                                  : r.status === 'rejected'
                                    ? 'bg-red-500/10 text-red-300 border-red-500/30'
                                    : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
                              }`}>{String(r.status || '').toUpperCase()}</span>
                            </div>
                            {r.issued_license_key ? (
                              <div className="mt-2 flex items-center gap-2">
                                <code className="flex-1 font-mono text-[10px] text-cyan-300 bg-black/40 px-2 py-1.5 rounded border border-cyan-500/20 truncate">
                                  {r.issued_license_key}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard.writeText(r.issued_license_key)}
                                  className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30"
                                  title="Copy license key"
                                >
                                  <Copy className="w-4 h-4 text-cyan-300" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
              </div>
            </div>
          )}
        </div>
      </details>

      {/* Exness Broker Recommendation */}
      <div className="mb-4 sm:mb-6">
        <ExnessBroker variant="compact" />
      </div>
      
      <div className="flex justify-between items-center mb-3 mt-6 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <h3 className="text-sm sm:text-lg font-semibold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>YOUR LICENSES</h3>
          <span className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-cyan-400 bg-cyan-500/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border border-cyan-500/30">
            <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
            Live
          </span>
        </div>
        <span className="text-[10px] sm:text-xs text-gray-500 bg-gray-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">{licenses.length} license(s)</span>
      </div>
      
      {pendingActivationCards.length > 0 ? (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-semibold text-yellow-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>PENDING ACTIVATIONS</h3>
            <span className="text-[10px] sm:text-xs text-gray-500">{pendingActivationCards.length} pending</span>
          </div>
          <div className="space-y-2">
            {pendingActivationCards.map((p: any) => (
              <div
                key={p.license_key}
                onClick={() => handleSelectLicense(p)}
                className="bg-[#12121a] rounded-xl cursor-pointer hover:shadow-lg hover:shadow-yellow-500/10 transition-all border border-yellow-500/20 hover:border-yellow-400/50 overflow-hidden"
              >
                <div className="px-3 sm:px-5 py-3 bg-gradient-to-r from-yellow-500/10 to-transparent border-b border-yellow-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">PENDING</span>
                    <span className="text-white font-bold text-xs sm:text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>{p.plan}</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Open →</div>
                </div>
                <div className="px-3 sm:px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-500">Request</p>
                    <p className="text-xs text-white font-mono">#{p.request?.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">MT5</p>
                    <p className="text-xs text-gray-300">{p.mt5_account || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Network</p>
                    <p className="text-xs text-gray-300">{p.request?.network?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Created</p>
                    <p className="text-xs text-gray-300">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {licenses.length === 0 ? (
        <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-4 sm:p-8 text-center">
          <p className="text-2xl sm:text-4xl mb-2 sm:mb-3">🔑</p>
          <h3 className="text-sm sm:text-lg font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>No Active Licenses Found</h3>
          <p className="text-gray-500 text-xs sm:text-sm">Purchase a plan above to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...licenses].sort((a, b) => {
            // Check if EA is online for each license
            const aTradeData = allTradeData[a.license_key];
            const bTradeData = allTradeData[b.license_key];
            const aOnline = aTradeData && aTradeData.last_update && 
              (Math.abs(new Date().getTime() - new Date(aTradeData.last_update).getTime()) / 1000) < 15;
            const bOnline = bTradeData && bTradeData.last_update && 
              (Math.abs(new Date().getTime() - new Date(bTradeData.last_update).getTime()) / 1000) < 15;
            
            // Online EAs first
            if (aOnline && !bOnline) return -1;
            if (!aOnline && bOnline) return 1;
            
            // Then active licenses
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            
            // Then by expiry date
            const aExpiry = new Date(a.expires_at || 0).getTime();
            const bExpiry = new Date(b.expires_at || 0).getTime();
            return bExpiry - aExpiry;
          }).map((lic, idx) => {
            const licTradeData = allTradeData[lic.license_key];
            const balance = licTradeData?.account_balance;
            const profit = licTradeData?.account_profit;
            const symbol = licTradeData?.symbol;
            const currentPrice = licTradeData?.current_price;
            const totalPositions = (licTradeData?.total_buy_positions || 0) + (licTradeData?.total_sell_positions || 0);
            const isConnected = licTradeData && licTradeData.last_update && 
              (Math.abs(new Date().getTime() - new Date(licTradeData.last_update).getTime()) / 1000) < 15;
            const tradingMode = licTradeData?.trading_mode;
            const isRecoveryMode = tradingMode?.toLowerCase().includes('recovery');
            
            return (
            <div 
              key={idx}
              onClick={() => handleSelectLicense(lic)}
              className="bg-[#12121a] rounded-xl cursor-pointer hover:shadow-lg hover:shadow-cyan-500/10 transition-all border border-cyan-500/20 hover:border-cyan-400/50 group overflow-hidden"
            >
              {/* Header Row - Plan + Open Button */}
              <div className="px-3 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-cyan-500/5 to-transparent border-b border-cyan-500/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isConnected ? 'bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50' : 'bg-gray-600'}`}></div>
                  <span className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                    lic.status === 'active' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {lic.status?.toUpperCase()}
                  </span>
                  <span className="font-bold text-white text-sm sm:text-base" style={{ fontFamily: 'Orbitron, sans-serif' }}>{lic.plan}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-cyan-400 group-hover:text-cyan-300 font-semibold text-xs sm:text-sm">
                  <span>Open</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
              
              {/* Trading Mode Row - Only show when connected AND tradingMode exists */}
              {isConnected && tradingMode && (
                <div className="px-3 sm:px-5 py-2 border-b border-cyan-500/10">
                  <span className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold border ${
                    isRecoveryMode 
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                      : 'bg-green-500/20 text-green-400 border-green-500/30'
                  }`}>
                    <svg 
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4`}
                      style={{ animation: isRecoveryMode ? 'spin 0.5s linear infinite' : 'spin 3s linear infinite' }}
                      viewBox="0 0 24 24" 
                      fill="none"
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                      <circle cx="12" cy="4" r="2" fill="currentColor" />
                    </svg>
                    {tradingMode === 'Normal' ? 'Normal Mode Running' : tradingMode}
                  </span>
                </div>
              )}
              
              {/* License Expiry Warning */}
              {getDaysRemaining(lic) <= 7 && (
                <div className={`px-3 sm:px-5 py-2 border-b border-cyan-500/10 ${
                  getDaysRemaining(lic) <= 0 
                    ? 'bg-red-500/10' 
                    : getDaysRemaining(lic) <= 3 
                      ? 'bg-orange-500/10' 
                      : 'bg-yellow-500/10'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {getDaysRemaining(lic) <= 0 
                        ? '🚨' 
                        : getDaysRemaining(lic) <= 3 
                          ? '⚠️' 
                          : '⏰'}
                    </span>
                    <div>
                      <p className={`text-xs sm:text-sm font-semibold ${
                        getDaysRemaining(lic) <= 0 
                          ? 'text-red-400' 
                          : getDaysRemaining(lic) <= 3 
                            ? 'text-orange-400' 
                            : 'text-yellow-400'
                      }`}>
                        {getDaysRemaining(lic) <= 0 
                          ? 'License Expired!' 
                          : getDaysRemaining(lic) <= 3 
                            ? 'Expiring Soon!' 
                            : 'Expires in 7 Days!'}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-400">
                        {getDaysRemaining(lic) <= 0 
                          ? 'Click to extend your license' 
                          : `${getDaysRemaining(lic)} ${getDaysRemaining(lic) === 1 ? 'day' : 'days'} remaining`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Symbol & Price Row */}
              {symbol && (
                <div className="px-3 sm:px-5 py-2 bg-gradient-to-r from-yellow-500/5 to-transparent border-b border-yellow-500/10">
                  <span className="text-xs sm:text-sm text-yellow-400 font-semibold">
                    {symbol} @ {currentPrice || ''}
                  </span>
                </div>
              )}
              
              {/* License Key Row - Simplified for mobile */}
              <div className="px-3 sm:px-5 py-2 bg-[#0a0a0f]/50 border-b border-cyan-500/10">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs text-gray-500">License:</span>
                    <code className="text-[10px] sm:text-xs font-mono text-cyan-400 bg-[#0a0a0f] px-1.5 sm:px-2 py-0.5 rounded border border-cyan-500/20 truncate max-w-[150px] sm:max-w-none">
                      {lic.license_key}
                    </code>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(lic.license_key);
                        const btn = e.currentTarget;
                        btn.classList.add('copied');
                        setTimeout(() => btn.classList.remove('copied'), 1500);
                      }}
                      className="group p-1 rounded hover:bg-cyan-500/20 transition-all text-gray-400 hover:text-cyan-400 [&.copied]:text-green-400 [&.copied]:bg-green-500/20"
                      title="Copy license key"
                    >
                      <Copy className="w-3.5 h-3.5 group-[.copied]:hidden" />
                      <Check className="w-3.5 h-3.5 hidden group-[.copied]:block" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs text-gray-500">MT5:</span>
                    <span className="text-[10px] sm:text-xs font-medium text-gray-400">{lic.mt5_account || '-'}</span>
                  </div>
                </div>
              </div>
              
              {/* Stats Row - 3 cols on mobile, 5 on desktop */}
              <div className="px-3 sm:px-5 py-3 sm:py-4 grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Balance</p>
                  <p className="text-sm sm:text-lg font-bold text-white">${balance?.toLocaleString() || '-'}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">P/L</p>
                  <p className={`text-sm sm:text-lg font-bold ${(profit || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                    {profit !== undefined ? `${profit >= 0 ? '+' : ''}$${profit?.toFixed(0)}` : '-'}
                  </p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Pos</p>
                  <p className="text-sm sm:text-lg font-bold text-white">{totalPositions}</p>
                </div>
                <div className="text-center sm:text-left hidden sm:block">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Status</p>
                  <p className={`text-sm sm:text-lg font-bold ${isConnected ? 'text-cyan-400' : 'text-gray-600'}`}>
                    {isConnected ? 'Online' : 'Offline'}
                  </p>
                </div>
                <div className="text-center sm:text-left hidden sm:block">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Expires</p>
                  <p className={`text-sm sm:text-lg font-bold ${getDaysRemaining(lic) <= 7 ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {getDaysRemaining(lic)} {getDaysRemaining(lic) === 1 ? 'day' : 'days'}
                  </p>
                </div>
              </div>
              {/* Mobile-only: Status & Expires row */}
              <div className="sm:hidden px-3 pb-3 grid text-center grid-cols-2 gap-2 border-t border-cyan-500/10 pt-2">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500">Status</p>
                  <p className={`text-sm font-bold ${isConnected ? 'text-cyan-400' : 'text-gray-600'}`}>
                    {isConnected ? 'Online' : 'Offline'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500">Expires</p>
                  <p className={`text-sm font-bold ${getDaysRemaining(lic) <= 7 ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {getDaysRemaining(lic)} {getDaysRemaining(lic) === 1 ? 'day' : 'days'}
                  </p>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Extend License Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl p-6 w-full max-h-[90vh] overflow-y-auto border border-purple-500/30 ${
            plans.length === 1 ? 'max-w-md' : plans.length === 2 ? 'max-w-2xl' : 'max-w-4xl'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Extend Your License</h2>
              </div>
              <button
                onClick={() => setShowExtendModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className={`grid gap-6 ${
              plans.length === 1 ? 'grid-cols-1' : 
              plans.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 
              'grid-cols-1 md:grid-cols-3'
            }`}>
              {plans.map((plan: any, index: number) => (
                <div
                  key={plan.id}
                  className={`relative bg-gradient-to-br from-white/5 to-transparent backdrop-blur-lg rounded-xl p-6 border transition-all hover:scale-105 ${
                    index === 1
                      ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/10'
                      : 'border-cyan-500/20 hover:border-cyan-500/40'
                  }`}
                >
                  {index === 1 && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-cyan-500 to-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">
                        MOST POPULAR
                      </span>
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-white mb-2 text-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    {plan.name}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4 text-center">
                    {plan.description}
                  </p>
                  <div className="mb-6 text-center">
                    <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      ${plan.price}
                    </span>
                    <span className="text-gray-500 text-sm">
                      /{plan.duration_days} days
                    </span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      {plan.max_accounts} MT5 Account{plan.max_accounts > 1 ? 's' : ''}
                    </li>
                    <li className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      AI-Powered Trading
                    </li>
                    <li className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      24/7 Support
                    </li>
                    <li className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      Regular Updates
                    </li>
                  </ul>
                  <button
                    onClick={() => handleExtendLicense(plan.id)}
                    disabled={extendingPlan === plan.id}
                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                      index === 1
                        ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 text-black shadow-lg shadow-cyan-500/25'
                        : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {extendingPlan === plan.id ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>Extend Now</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
