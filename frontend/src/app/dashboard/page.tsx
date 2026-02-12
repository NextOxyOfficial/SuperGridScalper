'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check, X, Sparkles, CheckCircle, Loader2, Upload, RefreshCw, Wallet, Clock, Pencil } from 'lucide-react';
import { useDashboard } from './context';
import axios from 'axios';
import ExnessBroker from '@/components/ExnessBroker';
import QRCode from 'qrcode';

const POLLING_INTERVAL = 2000; // Faster polling for real-time updates
const EA_CONNECTED_TIMEOUT_SECONDS = 120; // Allow up to 2min between heartbeats before marking disconnected

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
  const tradeDataRef = useRef<any>(null);
  
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
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [refreshedMsg, setRefreshedMsg] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [walletCopied, setWalletCopied] = useState(false);

  const lastAutoLicenseRefreshRef = useRef<number>(0);
  const purchaseRequestsPollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Positions tab state
  const [positionsTab, setPositionsTab] = useState<'open' | 'closed'>('open');
  const closedPositionsRef = useRef<HTMLDivElement>(null);

  // Extend license modal state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendStep, setExtendStep] = useState<1 | 2 | 3>(1); // 1=select plan, 2=payment, 3=success
  const [extendSelectedPlan, setExtendSelectedPlan] = useState<any>(null);
  const [extendNetworkId, setExtendNetworkId] = useState<string>('');
  const [extendTxid, setExtendTxid] = useState('');
  const [extendNote, setExtendNote] = useState('');
  const [extendProofFile, setExtendProofFile] = useState<File | null>(null);
  const [extendSubmitting, setExtendSubmitting] = useState(false);
  const [extendSuccess, setExtendSuccess] = useState<any>(null);
  const [extendQrCode, setExtendQrCode] = useState('');

  // License toggle state
  const [togglingLicense, setTogglingLicense] = useState<string | null>(null);

  // Nickname editing state
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);

  const nicknameInputRef = useRef<HTMLInputElement>(null);
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
    .filter((r) => String(r.status || '').toLowerCase() === 'pending' && r.request_type !== 'extension')
    .map((r) => ({
      _type: 'purchase_request',
      status: 'pending',
      license_key: `PENDING-${r.id}`,
      plan: typeof r.plan === 'string' ? r.plan : (r.plan?.name || '-'),
      mt5_account: r.mt5_account,
      created_at: r.created_at,
      request: r,
    }));

  const allPaymentRequests = (purchaseRequests || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const pendingPaymentRequests = allPaymentRequests.filter(
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

        // If purchaseSuccess is showing, update it with latest server data
        if (purchaseSuccess) {
          const updated = nextRequests.find((r: any) => 
            r.id === purchaseSuccess.id || r.request_number === purchaseSuccess.request_number
          );
          if (updated && updated.status !== purchaseSuccess.status) {
            setPurchaseSuccess(updated);
          }
        }

        // If admin approved any request, refresh licenses (new license or extension)
        try {
          const approvedRequests = (nextRequests || [])
            .filter((r: any) => String(r?.status || '').toLowerCase() === 'approved');
          
          const hasNewApproved = approvedRequests.some((r: any) => 
            r?.issued_license_key && !(licenses || []).some((l: any) => String(l?.license_key) === String(r.issued_license_key))
          );
          
          // Also refresh if any extension was recently approved (plan/expiry may have changed)
          const hasExtensionApproved = approvedRequests.some((r: any) => 
            r?.request_type === 'extension' && r?.extend_license_key
          );
          
          const now = Date.now();
          if ((hasNewApproved || hasExtensionApproved) && now - lastAutoLicenseRefreshRef.current > 5000) {
            lastAutoLicenseRefreshRef.current = now;
            await refreshLicenses();
            // After refresh, re-read licenses from localStorage (since state may not be updated yet)
            if (hasExtensionApproved && selectedLicense) {
              try {
                const freshData = localStorage.getItem('licenses');
                if (freshData) {
                  const freshLicenses = JSON.parse(freshData);
                  const updated = freshLicenses.find((l: any) => l.license_key === selectedLicense.license_key);
                  if (updated && (updated.plan !== selectedLicense.plan || updated.expires_at !== selectedLicense.expires_at)) {
                    selectLicense({ ...selectedLicense, ...updated });
                  }
                }
              } catch (_) {}
            }
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
    
    const updates: {[key: string]: any} = {};
    await Promise.all(licenses.map(async (lic) => {
      try {
        const res = await fetch(`${API_URL}/trade-data/?license_key=${lic.license_key}`);
        const data = await res.json();
        if (data.success && data.data) {
          updates[lic.license_key] = data.data;
        }
      } catch (e) {
        // Keep previous data on failure - don't clear it
      }
    }));
    // Merge with previous data so nothing flickers
    setAllTradeData(prev => ({ ...prev, ...updates }));
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
        const prevData = tradeDataRef.current;
        setTradeData(data.data);
        tradeDataRef.current = data.data;
        setLastUpdate(new Date());
        
        // Check if EA is connected - multiple strategies
        let connected = false;
        
        // Strategy 1: Check last_update timestamp
        if (data.data.last_update) {
          const lastUpdated = new Date(data.data.last_update);
          const now = new Date();
          const diffSeconds = Math.abs(now.getTime() - lastUpdated.getTime()) / 1000;
          connected = diffSeconds < EA_CONNECTED_TIMEOUT_SECONDS;
        }
        
        // Strategy 2: If data has changed since last poll, EA is definitely connected
        if (!connected && prevData) {
          const dataChanged = 
            data.data.account_balance !== prevData.account_balance ||
            data.data.account_equity !== prevData.account_equity ||
            data.data.account_profit !== prevData.account_profit ||
            data.data.total_buy_positions !== prevData.total_buy_positions ||
            data.data.total_sell_positions !== prevData.total_sell_positions;
          if (dataChanged) connected = true;
        }
        
        // Strategy 3: If we have active positions/balance, assume connected
        if (!connected) {
          const hasActivity = data.data.symbol && (data.data.account_balance > 0 || data.data.total_buy_positions > 0 || data.data.total_sell_positions > 0);
          if (hasActivity) connected = true;
        }
        
        setEaConnected(connected);
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

  const handleExtendSelectPlan = (plan: any) => {
    setExtendSelectedPlan(plan);
    setExtendStep(2);
    // Set default network
    if (paymentNetworks.length > 0 && !extendNetworkId) {
      setExtendNetworkId(String(paymentNetworks[0].id));
    }
  };

  // Generate QR code for extend modal
  useEffect(() => {
    const network = paymentNetworks.find((n: any) => String(n.id) === String(extendNetworkId));
    if (network?.wallet_address) {
      QRCode.toDataURL(network.wallet_address, { width: 200, margin: 1, color: { dark: '#000000', light: '#FFFFFF' } })
        .then((url: string) => setExtendQrCode(url))
        .catch(() => setExtendQrCode(''));
    } else {
      setExtendQrCode('');
    }
  }, [extendNetworkId, paymentNetworks]);

  const handleExtendSubmit = async () => {
    if (!selectedLicense || !extendSelectedPlan || !extendNetworkId || !extendProofFile) return;
    
    setExtendSubmitting(true);
    try {
      const form = new FormData();
      form.append('email', user?.email || (user as any)?.username || '');
      form.append('license_key', selectedLicense.license_key);
      form.append('plan_id', String(extendSelectedPlan.id));
      form.append('network_id', String(extendNetworkId));
      form.append('txid', extendTxid.trim());
      form.append('user_note', extendNote.trim());
      form.append('proof', extendProofFile);

      const res = await fetch(`${API_URL}/extension-requests/create/`, {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      if (data.success) {
        setExtendSuccess(data.request);
        setExtendStep(3);
        // Add to purchase requests list
        setPurchaseRequests((prev) => [
          {
            id: data.request?.id,
            request_number: data.request?.request_number,
            request_type: 'extension',
            status: 'pending',
            created_at: data.request?.created_at || new Date().toISOString(),
            plan: extendSelectedPlan?.name || '-',
            plan_id: extendSelectedPlan?.id,
            amount_usd: extendSelectedPlan?.price,
            extend_license_key: selectedLicense.license_key,
            network: paymentNetworks.find((n: any) => String(n.id) === String(extendNetworkId)) || {},
            mt5_account: selectedLicense.mt5_account,
            txid: extendTxid.trim(),
            user_note: extendNote.trim(),
            admin_note: null,
            proof_url: null,
            issued_license_key: null,
          },
          ...(prev || []),
        ]);
        fetchPurchaseRequests();
      } else {
        alert('❌ ' + (data.message || 'Failed to submit extension request.'));
      }
    } catch (error: any) {
      alert('❌ Failed to submit extension request. Please try again.');
    } finally {
      setExtendSubmitting(false);
    }
  };

  const resetExtendModal = () => {
    setShowExtendModal(false);
    setExtendStep(1);
    setExtendSelectedPlan(null);
    setExtendNetworkId('');
    setExtendTxid('');
    setExtendNote('');
    setExtendProofFile(null);
    setExtendSubmitting(false);
    setExtendSuccess(null);
    setExtendQrCode('');
  };

  const handleToggleLicense = async (licenseKey: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? 'deactivate' : 'activate';
    const confirmMsg = action === 'deactivate' 
      ? 'Are you sure you want to deactivate this license? The EA will stop trading.' 
      : 'Are you sure you want to activate this license?';
    if (!confirm(confirmMsg)) return;

    setTogglingLicense(licenseKey);
    try {
      const res = await fetch(`${API_URL}/toggle-license/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKey,
          email: user?.email || user?.username,
          action
        })
      });
      const data = await res.json();
      if (data.success) {
        // Refresh licenses from server
        await refreshLicenses();
        // If this is the selected license, update it
        if (selectedLicense?.license_key === licenseKey) {
          selectLicense({ ...selectedLicense, status: data.license.status });
        }
      } else {
        alert(data.message || 'Failed to toggle license');
      }
    } catch (e) {
      alert('Failed to toggle license. Please try again.');
    } finally {
      setTogglingLicense(null);
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
                    {isPurchaseRequest ? 'PENDING ACTIVATION' : selectedLicense.status === 'suspended' ? 'DEACTIVATED' : String(selectedLicense.status || 'INACTIVE').toUpperCase()}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {isPurchaseRequest
                      ? 'Your purchase is under verification. Once approved, your license will be activated.'
                      : isExpiredLicense
                        ? 'Your license has expired. Extend now to continue trading.'
                        : selectedLicense.status === 'suspended'
                          ? 'You have deactivated this license. Click Activate to resume trading.'
                          : 'This license is not active. Trading dashboard is unavailable.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedLicense.status === 'suspended' && (
                    <button
                      type="button"
                      onClick={() => handleToggleLicense(selectedLicense.license_key, selectedLicense.status)}
                      disabled={togglingLicense === selectedLicense.license_key}
                      className={`px-3 py-2 rounded-lg text-xs font-bold bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 ${togglingLicense === selectedLicense.license_key ? 'opacity-50 cursor-wait' : ''}`}
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      {togglingLicense === selectedLicense.license_key ? 'Activating...' : 'Activate'}
                    </button>
                  )}
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

              {/* Extend License Modal for expired/inactive licenses */}
              {showExtendModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className={`bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl p-4 sm:p-6 w-full max-h-[90vh] overflow-y-auto border border-purple-500/30 ${
                    extendStep === 1 ? (plans.length === 1 ? 'max-w-md' : plans.length === 2 ? 'max-w-2xl' : 'max-w-4xl') : 'max-w-lg'
                  }`}>
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                        <h2 className="text-lg sm:text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                          {extendStep === 1 ? 'Extend License' : extendStep === 2 ? 'Payment Details' : 'Request Submitted'}
                        </h2>
                      </div>
                      <button onClick={resetExtendModal} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-4 sm:mb-6">
                      {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-2 flex-1">
                          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            s <= extendStep ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-500'
                          }`}>{s}</div>
                          {s < 3 && <div className={`flex-1 h-0.5 rounded ${s < extendStep ? 'bg-cyan-500' : 'bg-gray-700'}`} />}
                        </div>
                      ))}
                    </div>
                    {extendStep === 1 && (
                      <div className={`grid gap-4 sm:gap-6 ${plans.length === 1 ? 'grid-cols-1' : plans.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
                        {plans.map((plan: any, index: number) => (
                          <div key={plan.id} className={`relative bg-gradient-to-br from-white/5 to-transparent backdrop-blur-lg rounded-xl p-4 sm:p-6 border transition-all hover:scale-105 cursor-pointer ${
                            index === 1 ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/10' : 'border-cyan-500/20 hover:border-cyan-500/40'
                          }`} onClick={() => handleExtendSelectPlan(plan)}>
                            {index === 1 && <div className="absolute -top-3 left-1/2 transform -translate-x-1/2"><span className="bg-gradient-to-r from-cyan-500 to-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</span></div>}
                            <h3 className="text-lg sm:text-xl font-bold text-white mb-1 text-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>{plan.name}</h3>
                            <p className="text-gray-400 text-xs sm:text-sm mb-3 text-center">{plan.description}</p>
                            <div className="mb-4 text-center">
                              <span className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${plan.price}</span>
                              <span className="text-gray-500 text-sm"> /{plan.duration_days} days</span>
                            </div>
                            <div className="text-center text-cyan-400 text-xs font-semibold">Add {plan.duration_days} {plan.duration_days === 1 ? 'day' : 'days'} to your license</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {extendStep === 2 && extendSelectedPlan && (() => {
                      const extendNetwork = paymentNetworks.find((n: any) => String(n.id) === String(extendNetworkId));
                      return (
                        <div className="space-y-4">
                          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div><p className="text-cyan-400 font-bold text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>{extendSelectedPlan.name}</p><p className="text-gray-400 text-xs">Add {extendSelectedPlan.duration_days} days to your license</p></div>
                              <div className="text-right"><p className="text-white font-bold text-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>${extendSelectedPlan.price}</p><button onClick={() => setExtendStep(1)} className="text-cyan-400 text-xs hover:underline">Change plan</button></div>
                            </div>
                          </div>
                          <div><label className="text-gray-400 text-xs mb-1.5 block">Payment Network</label><div className="flex flex-wrap gap-2">{paymentNetworks.map((n: any) => (<button key={n.id} type="button" onClick={() => setExtendNetworkId(String(n.id))} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${String(n.id) === String(extendNetworkId) ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-white/5 text-gray-400 border-gray-700 hover:border-gray-500'}`}>{n.name} ({n.token_symbol})</button>))}</div></div>
                          {extendNetwork?.wallet_address && (
                            <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3">
                              <p className="text-gray-400 text-xs mb-2">Send exactly <span className="text-cyan-400 font-bold">${extendSelectedPlan.price}</span> in <span className="text-cyan-400 font-bold">{extendNetwork.token_symbol}</span> to:</p>
                              <div className="flex items-center gap-2 bg-black/50 rounded p-2"><code className="text-cyan-400 text-xs break-all flex-1">{extendNetwork.wallet_address}</code><button onClick={() => navigator.clipboard.writeText(extendNetwork.wallet_address)} className="p-1.5 rounded hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 transition-all flex-shrink-0"><Copy className="w-3.5 h-3.5" /></button></div>
                              {extendQrCode && <div className="flex justify-center mt-3"><img src={extendQrCode} alt="QR Code" className="w-32 h-32 rounded-lg border border-cyan-500/20" /></div>}
                            </div>
                          )}
                          <div><label className="text-gray-400 text-xs mb-1.5 block">Transaction ID (TXID)</label><input type="text" value={extendTxid} onChange={(e) => setExtendTxid(e.target.value)} placeholder="Paste your transaction hash..." className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none" /></div>
                          <div><label className="text-gray-400 text-xs mb-1.5 block">Payment Proof (Screenshot) *</label><label className="flex items-center justify-center gap-2 w-full bg-[#0a0a0f] border border-dashed border-cyan-500/30 rounded-lg px-3 py-3 cursor-pointer hover:border-cyan-500/50 transition-all"><Upload className="w-4 h-4 text-gray-400" /><span className="text-gray-400 text-xs">{extendProofFile ? extendProofFile.name : 'Click to upload proof'}</span><input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setExtendProofFile(e.target.files?.[0] || null)} /></label></div>
                          <div><label className="text-gray-400 text-xs mb-1.5 block">Note (optional)</label><textarea value={extendNote} onChange={(e) => setExtendNote(e.target.value)} placeholder="Any additional info..." rows={2} className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none resize-none" /></div>
                          <button onClick={handleExtendSubmit} disabled={extendSubmitting || !extendProofFile || !extendNetworkId} className="w-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-700 disabled:to-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed text-black py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:shadow-none flex items-center justify-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>{extendSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><Upload className="w-4 h-4" /> Submit Extension Request</>}</button>
                        </div>
                      );
                    })()}
                    {extendStep === 3 && (
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-full flex items-center justify-center"><CheckCircle className="w-8 h-8 text-emerald-400" /></div>
                        <div><h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Extension Request Submitted!</h3><p className="text-gray-400 text-sm">Your payment is being reviewed. Once approved, your license will be automatically extended.</p></div>
                        <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3 text-left space-y-1">
                          <div className="flex justify-between text-xs"><span className="text-gray-500">Request</span><span className="text-white">#{extendSuccess?.request_number || extendSuccess?.id}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-500">Plan</span><span className="text-cyan-400">{extendSelectedPlan?.name}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-500">Amount</span><span className="text-white">${extendSelectedPlan?.price}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-500">Status</span><span className="text-yellow-400 font-bold">PENDING APPROVAL</span></div>
                        </div>
                        <button onClick={resetExtendModal} className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-2.5 rounded-lg font-bold text-sm transition-all" style={{ fontFamily: 'Orbitron, sans-serif' }}>Done</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
              <span
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-xs font-medium ${
                  eaConnected ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-400'
                }`}
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${eaConnected ? 'bg-black animate-pulse' : 'bg-gray-500'}`}></span>
                {eaConnected ? 'LIVE' : 'OFFLINE'}
              </span>
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
                style={{ height: '220px' }}
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
                    <div className="flex items-center gap-1.5">
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
                      <button
                        onClick={() => handleToggleLicense(selectedLicense.license_key, selectedLicense.status)}
                        disabled={togglingLicense === selectedLicense.license_key}
                        className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg transition-all whitespace-nowrap font-bold border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 ${togglingLicense === selectedLicense.license_key ? 'opacity-50 cursor-wait' : ''}`}
                      >
                        <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{togglingLicense === selectedLicense.license_key ? '...' : 'Deactivate'}</span>
                      </button>
                    </div>
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
                <div className={`rounded-lg p-3 sm:p-4 border ${
                  getDaysRemaining(selectedLicense) <= 0 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : getDaysRemaining(selectedLicense) <= 3 
                      ? 'bg-orange-500/10 border-orange-500/30' 
                      : getDaysRemaining(selectedLicense) <= 7
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-cyan-500/5 border-cyan-500/20'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className={`font-semibold text-sm sm:text-base ${
                        getDaysRemaining(selectedLicense) <= 0 
                          ? 'text-red-400' 
                          : getDaysRemaining(selectedLicense) <= 3 
                            ? 'text-orange-400' 
                            : getDaysRemaining(selectedLicense) <= 7
                              ? 'text-yellow-400'
                              : 'text-cyan-400'
                      }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                        {getDaysRemaining(selectedLicense) <= 0 
                          ? '🚨 License Expired!' 
                          : getDaysRemaining(selectedLicense) <= 3 
                            ? '⚠️ License Expiring Soon!' 
                            : getDaysRemaining(selectedLicense) <= 7
                              ? '⏰ License Expiring in 7 Days!'
                              : `📅 ${getDaysRemaining(selectedLicense)} Days Remaining`}
                      </p>
                      <p className="text-gray-400 text-[10px] sm:text-xs mt-1">
                        {getDaysRemaining(selectedLicense) <= 0 
                          ? 'Your license has expired. Extend now to continue trading.' 
                          : getDaysRemaining(selectedLicense) <= 3 
                            ? `Only ${getDaysRemaining(selectedLicense)} ${getDaysRemaining(selectedLicense) === 1 ? 'day' : 'days'} remaining. Extend to avoid interruption.`
                            : `Extend your subscription anytime to add more days.`}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowExtendModal(true)}
                      className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                        getDaysRemaining(selectedLicense) <= 0 
                          ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white shadow-lg shadow-red-500/20' 
                          : getDaysRemaining(selectedLicense) <= 7
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black shadow-lg shadow-yellow-500/20'
                            : 'bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black shadow-lg shadow-cyan-500/20'
                      }`}
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      <Sparkles className="w-4 h-4" />
                      EXTEND LICENSE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Extend License Modal - Multi-step Payment Flow */}
        {showExtendModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className={`bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl p-4 sm:p-6 w-full max-h-[90vh] overflow-y-auto border border-purple-500/30 ${
              extendStep === 1 ? (plans.length === 1 ? 'max-w-md' : plans.length === 2 ? 'max-w-2xl' : 'max-w-4xl') : 'max-w-lg'
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                  <h2 className="text-lg sm:text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    {extendStep === 1 ? 'Extend License' : extendStep === 2 ? 'Payment Details' : 'Request Submitted'}
                  </h2>
                </div>
                <button onClick={resetExtendModal} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      s <= extendStep ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-500'
                    }`}>{s}</div>
                    {s < 3 && <div className={`flex-1 h-0.5 rounded ${s < extendStep ? 'bg-cyan-500' : 'bg-gray-700'}`} />}
                  </div>
                ))}
              </div>

              {/* Step 1: Select Plan */}
              {extendStep === 1 && (
                <div className={`grid gap-4 sm:gap-6 ${
                  plans.length === 1 ? 'grid-cols-1' : plans.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'
                }`}>
                  {plans.map((plan: any, index: number) => (
                    <div
                      key={plan.id}
                      className={`relative bg-gradient-to-br from-white/5 to-transparent backdrop-blur-lg rounded-xl p-4 sm:p-6 border transition-all hover:scale-105 cursor-pointer ${
                        index === 1 ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/10' : 'border-cyan-500/20 hover:border-cyan-500/40'
                      }`}
                      onClick={() => handleExtendSelectPlan(plan)}
                    >
                      {index === 1 && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-gradient-to-r from-cyan-500 to-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</span>
                        </div>
                      )}
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-1 text-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>{plan.name}</h3>
                      <p className="text-gray-400 text-xs sm:text-sm mb-3 text-center">{plan.description}</p>
                      <div className="mb-4 text-center">
                        <span className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${plan.price}</span>
                        <span className="text-gray-500 text-sm"> /{plan.duration_days} days</span>
                      </div>
                      <div className="text-center text-cyan-400 text-xs font-semibold">Add {plan.duration_days} {plan.duration_days === 1 ? 'day' : 'days'} to your license</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 2: Payment Details */}
              {extendStep === 2 && extendSelectedPlan && (() => {
                const extendNetwork = paymentNetworks.find((n: any) => String(n.id) === String(extendNetworkId));
                return (
                  <div className="space-y-4">
                    {/* Plan Summary */}
                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-cyan-400 font-bold text-sm" style={{ fontFamily: 'Orbitron, sans-serif' }}>{extendSelectedPlan.name}</p>
                          <p className="text-gray-400 text-xs">Add {extendSelectedPlan.duration_days} days to your license</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold text-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>${extendSelectedPlan.price}</p>
                          <button onClick={() => setExtendStep(1)} className="text-cyan-400 text-xs hover:underline">Change plan</button>
                        </div>
                      </div>
                    </div>

                    {/* Payment Network */}
                    <div>
                      <label className="text-gray-400 text-xs mb-1.5 block">Payment Network</label>
                      <div className="flex flex-wrap gap-2">
                        {paymentNetworks.map((n: any) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => setExtendNetworkId(String(n.id))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              String(n.id) === String(extendNetworkId)
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                                : 'bg-white/5 text-gray-400 border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            {n.name} ({n.token_symbol})
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Wallet Address + QR */}
                    {extendNetwork?.wallet_address && (
                      <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3">
                        <p className="text-gray-400 text-xs mb-2">Send exactly <span className="text-cyan-400 font-bold">${extendSelectedPlan.price}</span> in <span className="text-cyan-400 font-bold">{extendNetwork.token_symbol}</span> to:</p>
                        <div className="flex items-center gap-2 bg-black/50 rounded p-2">
                          <code className="text-cyan-400 text-xs break-all flex-1">{extendNetwork.wallet_address}</code>
                          <button
                            onClick={() => navigator.clipboard.writeText(extendNetwork.wallet_address)}
                            className="p-1.5 rounded hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 transition-all flex-shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {extendQrCode && (
                          <div className="flex justify-center mt-3">
                            <img src={extendQrCode} alt="QR Code" className="w-32 h-32 rounded-lg border border-cyan-500/20" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* TXID */}
                    <div>
                      <label className="text-gray-400 text-xs mb-1.5 block">Transaction ID (TXID)</label>
                      <input
                        type="text"
                        value={extendTxid}
                        onChange={(e) => setExtendTxid(e.target.value)}
                        placeholder="Paste your transaction hash..."
                        className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none"
                      />
                    </div>

                    {/* Payment Proof Upload */}
                    <div>
                      <label className="text-gray-400 text-xs mb-1.5 block">Payment Proof (Screenshot) *</label>
                      <label className="flex items-center justify-center gap-2 w-full bg-[#0a0a0f] border border-dashed border-cyan-500/30 rounded-lg px-3 py-3 cursor-pointer hover:border-cyan-500/50 transition-all">
                        <Upload className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-xs">{extendProofFile ? extendProofFile.name : 'Click to upload proof'}</span>
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setExtendProofFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>

                    {/* Note */}
                    <div>
                      <label className="text-gray-400 text-xs mb-1.5 block">Note (optional)</label>
                      <textarea
                        value={extendNote}
                        onChange={(e) => setExtendNote(e.target.value)}
                        placeholder="Any additional info..."
                        rows={2}
                        className="w-full bg-[#0a0a0f] border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Submit */}
                    <button
                      onClick={handleExtendSubmit}
                      disabled={extendSubmitting || !extendProofFile || !extendNetworkId}
                      className="w-full bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:from-gray-700 disabled:to-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed text-black py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:shadow-none flex items-center justify-center gap-2"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      {extendSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><Upload className="w-4 h-4" /> Submit Extension Request</>}
                    </button>
                  </div>
                );
              })()}

              {/* Step 3: Success */}
              {extendStep === 3 && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>Extension Request Submitted!</h3>
                    <p className="text-gray-400 text-sm">Your payment is being reviewed. Once approved, your license will be automatically extended.</p>
                  </div>
                  <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3 text-left space-y-1">
                    <div className="flex justify-between text-xs"><span className="text-gray-500">Request</span><span className="text-white">#{extendSuccess?.request_number || extendSuccess?.id}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-500">Plan</span><span className="text-cyan-400">{extendSelectedPlan?.name}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-500">Amount</span><span className="text-white">${extendSelectedPlan?.price}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-500">Status</span><span className="text-yellow-400 font-bold">PENDING APPROVAL</span></div>
                  </div>
                  <button
                    onClick={resetExtendModal}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-2.5 rounded-lg font-bold text-sm transition-all"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Done
                  </button>
                </div>
              )}
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
      <details className="relative bg-gradient-to-br from-[#12121a] via-[#12121a] to-cyan-950/20 border-2 border-cyan-500/40 rounded-xl mb-4 sm:mb-6 overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.08)]" open={licenses.length === 0}>
        <summary className="p-3 sm:p-5 cursor-pointer font-semibold text-white hover:bg-cyan-500/5 rounded-xl flex items-center justify-between gap-2 transition-colors" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <span className="text-white text-lg sm:text-xl font-bold">+</span>
            </div>
            <div>
              <span className="text-sm sm:text-base block">PURCHASE NEW LICENSE</span>
              <span className="text-[10px] sm:text-xs text-cyan-400/60 font-normal block mt-0.5">Get started with AI-powered trading</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse">NEW</span>
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </summary>
        <div className="px-3 sm:px-4 pb-4 border-t border-cyan-500/20">
          {purchaseSuccess ? (
            <div className={`border rounded-lg p-4 mt-4 ${
              purchaseSuccess.status === 'approved' 
                ? 'bg-green-500/10 border-green-500/30' 
                : purchaseSuccess.status === 'rejected'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-cyan-500/10 border-cyan-500/30'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  purchaseSuccess.status === 'approved' ? 'bg-green-500/20' : purchaseSuccess.status === 'rejected' ? 'bg-red-500/20' : 'bg-cyan-500/20'
                }`}>
                  <CheckCircle className={`w-5 h-5 ${
                    purchaseSuccess.status === 'approved' ? 'text-green-400' : purchaseSuccess.status === 'rejected' ? 'text-red-400' : 'text-cyan-400'
                  }`} />
                </div>
                <div className="flex-1">
                  <h4 className={`text-base sm:text-lg font-bold ${
                    purchaseSuccess.status === 'approved' ? 'text-green-300' : purchaseSuccess.status === 'rejected' ? 'text-red-300' : 'text-cyan-300'
                  }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    {purchaseSuccess.status === 'approved' ? 'License Approved!' : purchaseSuccess.status === 'rejected' ? 'Request Rejected' : 'Submitted Successfully'}
                  </h4>
                  <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
                    {purchaseSuccess.status === 'approved' 
                      ? 'Your license has been activated. You can start trading now!'
                      : purchaseSuccess.status === 'rejected'
                        ? (purchaseSuccess.admin_note || 'Your payment was not approved. Please contact support.')
                        : <>Your payment proof has been submitted. Status: <span className="text-yellow-300 font-semibold">PENDING</span></>}
                  </p>

                  <div className="mt-3">
                    {renderActivationProgress(purchaseSuccess)}
                  </div>

                  {purchaseSuccess.issued_license_key && (
                    <div className="mt-3 bg-[#0a0a0f] border border-green-500/20 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500 mb-1">Your License Key</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 font-mono text-xs text-green-400 bg-black/40 px-2 py-1.5 rounded border border-green-500/20 truncate">
                          {purchaseSuccess.issued_license_key}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(purchaseSuccess.issued_license_key)}
                          className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30"
                          title="Copy license key"
                        >
                          <Copy className="w-3.5 h-3.5 text-green-300" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500">Request ID</p>
                      <p className="text-sm text-white font-mono">#{purchaseSuccess.request_number || purchaseSuccess.id}</p>
                    </div>
                    <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500">Amount</p>
                      <p className="text-sm text-yellow-300 font-bold">${purchaseSuccess.plan?.price || purchaseSuccess.amount_usd} {purchaseSuccess.payment?.token_symbol || purchaseSuccess.network?.token_symbol || ''}</p>
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
                        {pendingPaymentRequests.slice(0, 10).map((r) => (
                          <div key={r.id} className="bg-black/30 border border-cyan-500/10 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-white text-xs font-semibold">
                                  #{r.request_number || r.id}
                                  {r.request_type === 'extension' && <span className="text-yellow-400 ml-1">🔄 EXT</span>}
                                  {' • '}{r.plan} • ${r.amount_usd}
                                </p>
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
      
      <div className="mt-6 mb-3 sm:mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <h3 className="text-sm sm:text-lg font-semibold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>YOUR LICENSES</h3>
            <span className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-cyan-400 bg-cyan-500/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border border-cyan-500/30">
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
              Live
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs text-gray-500 bg-gray-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">{licenses.length} license(s)</span>
            {refreshedMsg && (
              <span className="text-[10px] sm:text-xs text-green-400 animate-pulse">Refreshed!</span>
            )}
            <button
              onClick={async () => {
                if (refreshing || refreshCooldown > 0) return;
                setRefreshing(true);
                setRefreshedMsg(false);
                try {
                  await refreshLicenses();
                  await fetchAllLicensesTradeData();
                  setRefreshedMsg(true);
                  setTimeout(() => setRefreshedMsg(false), 2000);
                } finally {
                  setRefreshing(false);
                  setRefreshCooldown(5);
                  const cd = setInterval(() => {
                    setRefreshCooldown(prev => {
                      if (prev <= 1) { clearInterval(cd); return 0; }
                      return prev - 1;
                    });
                  }, 1000);
                }
              }}
              disabled={refreshing || refreshCooldown > 0}
              className={`p-1.5 sm:p-2 rounded-lg border transition-all flex items-center gap-1.5 ${
                refreshing || refreshCooldown > 0
                  ? 'bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed'
                  : 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:text-cyan-300'
              }`}
              title={refreshCooldown > 0 ? `Wait ${refreshCooldown}s` : 'Refresh all data'}
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshCooldown > 0 && <span className="text-[10px] sm:text-xs tabular-nums">{refreshCooldown}s</span>}
            </button>
          </div>
        </div>
        {/* Portfolio Summary */}
        {licenses.length > 0 && (() => {
          const currentKeys = new Set(licenses.map(l => l.license_key));
          const relevantData = Object.entries(allTradeData).filter(([k]) => currentKeys.has(k)).map(([, v]) => v);
          const totalBalance = relevantData.reduce((sum: number, td: any) => sum + (td?.account_balance || 0), 0);
          const totalProfit = relevantData.reduce((sum: number, td: any) => sum + (td?.account_profit || 0), 0);
          const totalPositions = relevantData.reduce((sum: number, td: any) => sum + (td?.total_buy_positions || 0) + (td?.total_sell_positions || 0), 0);
          const hasData = relevantData.length > 0;
          return hasData ? (
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
              <div className="grid grid-cols-3 gap-3 sm:gap-6">
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Total Balance</p>
                  <p className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Total P/L</p>
                  <p className={`text-sm sm:text-lg font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Total Positions</p>
                  <p className="text-sm sm:text-lg font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>{totalPositions}</p>
                </div>
              </div>
            </div>
          ) : null;
        })()}
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
            const aTradeData = allTradeData[a.license_key];
            const bTradeData = allTradeData[b.license_key];
            const aBalance = aTradeData?.account_balance ?? 0;
            const bBalance = bTradeData?.account_balance ?? 0;
            const aActive = a.status === 'active';
            const bActive = b.status === 'active';
            
            // Primary: Active licenses on top, deactivated/expired below
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;
            
            // Secondary: Within same group, sort by balance high→low
            if (aBalance !== bBalance) return bBalance - aBalance;
            
            // Tertiary: by expiry date
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
              (Math.abs(new Date().getTime() - new Date(licTradeData.last_update).getTime()) / 1000) < 60;
            const tradingMode = licTradeData?.trading_mode;
            const isRecoveryMode = tradingMode?.toLowerCase().includes('recovery');
            
            return (
            <div 
              key={lic.license_key}
              onClick={() => handleSelectLicense(lic)}
              className="bg-[#12121a] rounded-xl cursor-pointer hover:shadow-lg hover:shadow-cyan-500/10 transition-all border border-cyan-500/20 hover:border-cyan-400/50 group overflow-hidden"
            >
              {/* Header Row - Plan + Open Button */}
              <div className="px-3 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-cyan-500/5 to-transparent border-b border-cyan-500/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isConnected ? 'bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50' : 'bg-gray-600'}`}></div>
                  <span className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                    lic.status === 'active' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                    : lic.status === 'suspended' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {lic.status === 'suspended' ? 'DEACTIVATED' : lic.status?.toUpperCase()}
                  </span>
                  <span className="font-bold text-white text-sm sm:text-base" style={{ fontFamily: 'Orbitron, sans-serif' }}>{lic.plan}</span>
                  {/* Nickname */}
                  {editingNickname === lic.license_key ? (
                    <form
                      className="flex items-center gap-1"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSavingNickname(true);
                        try {
                          await axios.post(`${API_URL}/license-nickname/`, {
                            email: user?.email,
                            license_key: lic.license_key,
                            nickname: nicknameValue.slice(0, 20),
                          });
                          refreshLicenses();
                        } catch (err) { console.error(err); }
                        setSavingNickname(false);
                        setEditingNickname(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={nicknameInputRef}
                        type="text"
                        value={nicknameValue}
                        onChange={(e) => setNicknameValue(e.target.value.slice(0, 20))}
                        maxLength={20}
                        placeholder="Nickname"
                        autoFocus
                        className="bg-[#0a0a0f] border border-cyan-500/30 rounded px-1.5 py-0.5 text-[10px] sm:text-xs text-white w-[100px] sm:w-[130px] focus:outline-none focus:border-cyan-400"
                        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditingNickname(null); } }}
                      />
                      <button type="submit" disabled={savingNickname} className="p-0.5 text-green-400 hover:text-green-300">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setEditingNickname(null); }} className="p-0.5 text-gray-500 hover:text-gray-300">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNickname(lic.license_key);
                        setNicknameValue(lic.nickname || '');
                      }}
                      className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 hover:text-cyan-400 transition-colors px-1.5 py-0.5 rounded hover:bg-cyan-500/10"
                      title="Set nickname"
                    >
                      {lic.nickname ? (
                        <span className="text-cyan-300 font-medium">{lic.nickname}</span>
                      ) : (
                        <span className="italic">Add name</span>
                      )}
                      <Pencil className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  {(lic.status === 'active' || lic.status === 'suspended') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLicense(lic.license_key, lic.status);
                      }}
                      disabled={togglingLicense === lic.license_key}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${
                        lic.status === 'active'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                          : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
                      } ${togglingLicense === lic.license_key ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      {togglingLicense === lic.license_key ? '...' : lic.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                  <div className="flex items-center gap-1 sm:gap-2 text-cyan-400 group-hover:text-cyan-300 font-semibold text-xs sm:text-sm">
                    <span>Open</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
              
              {/* Trading Mode Row - Show when tradingMode data exists (stable, no flicker) */}
              {tradingMode && (
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
                    {lic.mt5_account && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(lic.mt5_account);
                          const btn = e.currentTarget;
                          btn.classList.add('copied');
                          setTimeout(() => btn.classList.remove('copied'), 1500);
                        }}
                        className="group p-0.5 rounded hover:bg-cyan-500/20 transition-all text-gray-500 hover:text-cyan-400 [&.copied]:text-green-400 [&.copied]:bg-green-500/20"
                        title="Copy MT5 account"
                      >
                        <Copy className="w-3 h-3 group-[.copied]:hidden" />
                        <Check className="w-3 h-3 hidden group-[.copied]:block" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Stats Row */}
              <div className="px-3 sm:px-5 py-3 sm:py-4 grid grid-cols-4 gap-2 sm:gap-4">
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
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Expires</p>
                  <p className={`text-sm sm:text-lg font-bold ${getDaysRemaining(lic) <= 7 ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {getDaysRemaining(lic)} {getDaysRemaining(lic) === 1 ? 'day' : 'days'}
                  </p>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Extend modal is handled in the license details view */}
    </div>
  );
}
