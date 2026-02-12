'use client';

import { useState, useEffect } from 'react';
import { useDashboard } from '../context';
import { Copy, Check, DollarSign, Users, TrendingUp, Gift, ExternalLink, MousePointerClick, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function ReferralPage() {
  const { user, API_URL } = useDashboard();
  const [referralData, setReferralData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [paymentDetails, setPaymentDetails] = useState('');

  // Pagination state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(0);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);

  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutTotalPages, setPayoutTotalPages] = useState(0);
  const [payoutTotal, setPayoutTotal] = useState(0);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const [payoutTab, setPayoutTab] = useState<'request' | 'history'>('request');
  const [selectedLanding, setSelectedLanding] = useState<'main' | 'free-ea'>('main');

  const PER_PAGE = 10;

  useEffect(() => {
    if (user) {
      fetchReferralData();
    }
  }, [user]);

  useEffect(() => {
    if (user && referralData?.has_referral) {
      fetchTransactions(txPage);
    }
  }, [user, referralData?.has_referral, txPage]);

  useEffect(() => {
    if (user && referralData?.has_referral) {
      fetchPayouts(payoutPage);
    }
  }, [user, referralData?.has_referral, payoutPage]);

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/referral/stats/`, {
        params: { 
          username: user?.username,
          email: user?.email 
        }
      });

      if (response.data.success) {
        setReferralData(response.data);
      }
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (page: number) => {
    try {
      setTxLoading(true);
      const response = await axios.get(`${API_URL}/referral/transactions/`, {
        params: { username: user?.username, email: user?.email, page, per_page: PER_PAGE }
      });
      if (response.data.success) {
        setTransactions(response.data.transactions);
        setTxTotalPages(response.data.total_pages);
        setTxTotal(response.data.total);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setTxLoading(false);
    }
  };

  const fetchPayouts = async (page: number) => {
    try {
      setPayoutLoading(true);
      const response = await axios.get(`${API_URL}/referral/payouts/`, {
        params: { username: user?.username, email: user?.email, page, per_page: PER_PAGE }
      });
      if (response.data.success) {
        setPayouts(response.data.payouts);
        setPayoutTotalPages(response.data.total_pages);
        setPayoutTotal(response.data.total);
      }
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setPayoutLoading(false);
    }
  };

  const createReferralCode = async () => {
    try {
      console.log('Creating referral code for user:', user?.email);
      console.log('API URL:', `${API_URL}/referral/create/`);
      
      const response = await axios.post(`${API_URL}/referral/create/`, {
        username: user?.username,
        email: user?.email
      });

      console.log('Response:', response.data);

      if (response.data.success) {
        alert('Referral code created successfully!');
        fetchReferralData();
      } else {
        alert('Failed to create referral code: ' + response.data.message);
      }
    } catch (error: any) {
      console.error('Error creating referral code:', error);
      console.error('Error response:', error.response?.data);
      alert('Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const copyReferralLink = () => {
    const base = selectedLanding === 'free-ea'
      ? `https://markstrades.com/free-EA-trading?ref=${referralData?.referral_code}`
      : `https://markstrades.com?ref=${referralData?.referral_code}`;
    navigator.clipboard.writeText(base);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const requestPayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/referral/request-payout/`, {
        username: user?.username,
        email: user?.email,
        amount: parseFloat(payoutAmount),
        payment_method: paymentMethod,
        payment_details: { email: paymentDetails }
      });

      if (response.data.success) {
        alert('Payout request submitted successfully!');
        setPayoutAmount('');
        setPaymentDetails('');
        fetchReferralData();
        setPayoutPage(1);
        fetchPayouts(1);
        setPayoutTab('history');
      } else {
        alert(response.data.message);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error requesting payout');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading referral data...</p>
        </div>
      </div>
    );
  }

  if (!referralData?.has_referral) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white p-3 sm:p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500/20 to-green-400/10 border border-green-500/30 rounded-xl mb-4 sm:mb-6">
              <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Start Earning with Referrals!
            </h1>
            <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
              Refer friends and earn 10% commission on all their purchases. Share your unique referral link and start earning today!
            </p>
            <button
              onClick={createReferralCode}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-400 hover:from-green-400 hover:to-cyan-400 text-black px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base transition-all transform hover:scale-105 shadow-lg shadow-green-500/20"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
              Create My Referral Code
            </button>
          </div>
        </div>
      </div>
    );
  }

  const landingPages = {
    'main': {
      label: 'Main Website',
      description: 'Homepage with pricing & features',
      url: `https://markstrades.com?ref=${referralData?.referral_code}`,
    },
    'free-ea': {
      label: 'Free EA Trading',
      description: 'Free license promo landing page',
      url: `https://markstrades.com/free-EA-trading?ref=${referralData?.referral_code}`,
    },
  };

  const activeLink = landingPages[selectedLanding].url;

  const stats = referralData.stats;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-3 sm:p-4">
      <div className="max-w-6xl mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1.5 mb-2 sm:mb-3">
            <Gift className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
            <span className="text-green-400 text-[10px] sm:text-xs" style={{ fontFamily: 'Orbitron, sans-serif' }}>REFERRAL PROGRAM</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 sm:mb-2 text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Earn with Referrals
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm">Share your link and earn 10% commission on every purchase</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
          <div className="bg-[#12121a] border border-green-500/20 rounded-lg p-1.5 sm:p-3 hover:border-green-500/40 transition-all">
            <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-green-400 mb-1 sm:mb-2" />
            <p className="text-gray-500 text-[10px] sm:text-xs mb-0.5">Total Earnings</p>
            <p className="text-sm sm:text-xl lg:text-2xl font-bold text-green-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${stats.total_earnings.toFixed(2)}</p>
          </div>
          <div className="bg-[#12121a] border border-yellow-500/20 rounded-lg p-1.5 sm:p-3 hover:border-yellow-500/40 transition-all">
            <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-400 mb-1 sm:mb-2" />
            <p className="text-gray-500 text-[10px] sm:text-xs mb-0.5">Pending</p>
            <p className="text-sm sm:text-xl lg:text-2xl font-bold text-yellow-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>${stats.pending_earnings.toFixed(2)}</p>
          </div>
          <div className="bg-[#12121a] border border-orange-500/20 rounded-lg p-1.5 sm:p-3 hover:border-orange-500/40 transition-all">
            <MousePointerClick className="w-4 h-4 sm:w-6 sm:h-6 text-orange-400 mb-1 sm:mb-2" />
            <p className="text-gray-500 text-[10px] sm:text-xs mb-0.5">Link Clicks</p>
            <p className="text-sm sm:text-xl lg:text-2xl font-bold text-orange-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>{stats.clicks}</p>
          </div>
          <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-3 hover:border-cyan-500/40 transition-all">
            <Users className="w-4 h-4 sm:w-6 sm:h-6 text-cyan-400 mb-1 sm:mb-2" />
            <p className="text-gray-500 text-[10px] sm:text-xs mb-0.5">Signups</p>
            <p className="text-sm sm:text-xl lg:text-2xl font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>{stats.signups}</p>
          </div>
          <div className="bg-[#12121a] border border-purple-500/20 rounded-lg p-1.5 sm:p-3 hover:border-purple-500/40 transition-all col-span-3 lg:col-span-1">
            <Gift className="w-4 h-4 sm:w-6 sm:h-6 text-purple-400 mb-1 sm:mb-2" />
            <p className="text-gray-500 text-[10px] sm:text-xs mb-0.5">Purchases</p>
            <p className="text-sm sm:text-xl lg:text-2xl font-bold text-purple-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>{stats.purchases}</p>
          </div>
        </div>

        {/* Referral Link with Landing Page Selector */}
        <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-3 sm:p-4">
          <h2 className="text-sm sm:text-base font-bold mb-2 sm:mb-3 text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Your Referral Link</h2>
          
          {/* Landing Page Selector */}
          <h3 className="text-xs sm:text-sm font-bold text-gray-300 mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>Choose Your Landing Page</h3>
          <div className="flex gap-1.5 sm:gap-2 mb-3">
            {(Object.keys(landingPages) as Array<'main' | 'free-ea'>).map((key) => {
              const lp = landingPages[key];
              const isActive = selectedLanding === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedLanding(key)}
                  className={`flex-1 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg border-2 text-left transition-all ${
                    isActive
                      ? key === 'free-ea'
                        ? 'border-green-400 bg-green-500/10 shadow-md shadow-green-500/10'
                        : 'border-cyan-400 bg-cyan-500/10 shadow-md shadow-cyan-500/10'
                      : 'border-gray-700 bg-[#0a0a0f] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] sm:text-xs font-bold ${
                      isActive
                        ? key === 'free-ea' ? 'text-green-400' : 'text-cyan-400'
                        : 'text-gray-400'
                    }`} style={{ fontFamily: 'Orbitron, sans-serif' }}>{lp.label}</span>
                    {key === 'free-ea' && (
                      <span className="text-[8px] sm:text-[9px] font-bold text-green-200 bg-green-500/25 px-1 py-0.5 rounded-full border border-green-400/40 animate-pulse">FREE</span>
                    )}
                  </div>
                  <p className={`text-[9px] sm:text-[10px] ${isActive ? 'text-gray-300' : 'text-gray-600'}`}>{lp.description}</p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={activeLink}
              readOnly
              className="flex-1 bg-[#0a0a0f] border border-cyan-500/30 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={copyReferralLink}
              className="bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-yellow-400 text-black px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-gray-500 text-[10px] sm:text-xs mt-2">
            Code: <span className="text-cyan-400 font-mono font-bold">{referralData.referral_code}</span>
          </p>
        </div>

        {/* Free Exness Promo Banner */}
        <div className="bg-gradient-to-r from-[#0d1117] via-[#12121a] to-[#0d1117] border-2 border-green-500/30 rounded-xl overflow-hidden">
          <div className="relative">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" />
            <div className="p-3 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500/30 to-emerald-500/20 rounded-xl flex items-center justify-center border border-green-500/30 flex-shrink-0">
                  <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-sm sm:text-base" style={{ fontFamily: 'Orbitron, sans-serif' }}>FREE LICENSE FOR REFERRALS</h3>
                    <span className="text-[9px] sm:text-[10px] font-bold text-green-300 bg-green-500/20 px-1.5 py-0.5 rounded-full border border-green-400/40 animate-pulse">$0</span>
                  </div>
                  <p className="text-gray-400 text-[10px] sm:text-xs leading-relaxed mb-3">
                    Anyone who opens an <span className="text-yellow-400 font-semibold">Exness Standard Cent</span> account through your referral link gets a <span className="text-green-400 font-bold">FREE license</span>! 
                    Share this with your audience — they get free AI trading, and you earn commissions on their future purchases.
                  </p>
                  <div className="bg-[#0a0a0f] rounded-lg p-2.5 sm:p-3 border border-green-500/10">
                    <p className="text-green-400 font-semibold text-[10px] sm:text-xs mb-1.5">How your referrals get a free license:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 text-[8px] font-bold flex-shrink-0">1</span>
                        <p className="text-gray-400 text-[10px] sm:text-xs">Click your referral link & sign up</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 text-[8px] font-bold flex-shrink-0">2</span>
                        <p className="text-gray-400 text-[10px] sm:text-xs">Open Exness account via our link</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 text-[8px] font-bold flex-shrink-0">3</span>
                        <p className="text-gray-400 text-[10px] sm:text-xs">Claim free license in dashboard</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 text-[8px] font-bold flex-shrink-0">4</span>
                        <p className="text-gray-400 text-[10px] sm:text-xs">Contact support to verify & activate</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Request Payout / Payout History Tabbed Section */}
        <div className="bg-[#12121a] border border-green-500/20 rounded-xl p-3 sm:p-4">
          {/* Tabs */}
          <div className="flex gap-1 mb-3 sm:mb-4 bg-[#0a0a0f] rounded-lg p-0.5 w-fit">
            <button
              onClick={() => setPayoutTab('request')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-bold transition-all ${
                payoutTab === 'request'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Request Payout
            </button>
            <button
              onClick={() => setPayoutTab('history')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-bold transition-all ${
                payoutTab === 'history'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Payout History
              {payoutTotal > 0 && <span className="ml-1.5 text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full">{payoutTotal}</span>}
            </button>
          </div>

          {/* Request Payout Tab */}
          {payoutTab === 'request' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[10px] sm:text-xs text-gray-400 mb-1">Amount (USD)</label>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0.00"
                    max={stats.pending_earnings}
                    className="w-full bg-[#0a0a0f] border border-green-500/30 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-green-500/50"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Available: <span className="text-green-400 font-bold">${stats.pending_earnings.toFixed(2)}</span></p>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs text-gray-400 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-green-500/30 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-green-500/50"
                  >
                    {referralData.payout_methods && referralData.payout_methods.length > 0 ? (
                      referralData.payout_methods.map((m: any) => (
                        <option key={m.code} value={m.code}>{m.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="paypal">PayPal</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="crypto">Cryptocurrency</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs text-gray-400 mb-1">Payment Details</label>
                  <input
                    type="text"
                    value={paymentDetails}
                    onChange={(e) => setPaymentDetails(e.target.value)}
                    placeholder={
                      referralData.payout_methods?.find((m: any) => m.code === paymentMethod)?.placeholder
                      || 'Enter payment details'
                    }
                    className="w-full bg-[#0a0a0f] border border-green-500/30 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-green-500/50"
                  />
                </div>
              </div>
              <button
                onClick={requestPayout}
                className="mt-3 sm:mt-4 w-full sm:w-auto bg-gradient-to-r from-green-500 to-green-400 hover:from-green-400 hover:to-cyan-400 text-black px-6 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all transform hover:scale-105 shadow-lg shadow-green-500/20"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Request Payout
              </button>
            </div>
          )}

          {/* Payout History Tab */}
          {payoutTab === 'history' && (
            <div>
              {payoutLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
                  <span className="ml-2 text-gray-400 text-xs">Loading payouts...</span>
                </div>
              ) : payouts.length === 0 ? (
                <p className="text-gray-500 text-xs sm:text-sm text-center py-6">No payout history yet.</p>
              ) : (
                <>
                  <div className="divide-y divide-gray-800/50 -mx-3 sm:-mx-4">
                    {payouts.map((payout: any) => {
                      const payoutStatusConfig: Record<string, { bg: string; text: string }> = {
                        completed: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400' },
                        processing: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
                        failed: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400' },
                        pending: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400' },
                      };
                      const ps = payoutStatusConfig[payout.status] || payoutStatusConfig.pending;
                      return (
                        <div key={payout.id} className="px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <p className="text-white text-sm sm:text-base font-bold">${payout.amount.toFixed(2)}</p>
                              <span className="text-gray-400 text-[10px] sm:text-xs capitalize bg-gray-800/60 px-2 py-0.5 rounded">{payout.payment_method}</span>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-4">
                              <span className={`inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold border ${ps.bg} ${ps.text} capitalize`}>
                                {payout.status}
                              </span>
                              <div className="text-right">
                                <p className="text-gray-500 text-[10px] sm:text-xs">{new Date(payout.requested_at).toLocaleDateString()}</p>
                                {payout.processed_at && <p className="text-gray-600 text-[9px] sm:text-[10px]">Done: {new Date(payout.processed_at).toLocaleDateString()}</p>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Payout Pagination */}
                  {payoutTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/50">
                      <p className="text-gray-500 text-[10px] sm:text-xs">Page {payoutPage} of {payoutTotalPages}</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPayoutPage(p => Math.max(1, p - 1))}
                          disabled={payoutPage <= 1}
                          className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPayoutPage(p => Math.min(payoutTotalPages, p + 1))}
                          disabled={payoutPage >= payoutTotalPages}
                          className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-gradient-to-br from-[#0d1117] to-[#12121a] rounded-2xl border border-cyan-500/20 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-cyan-500/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <h2 className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Recent Transactions</h2>
            </div>
            <span className="text-[10px] sm:text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{txTotal} transaction{txTotal !== 1 ? 's' : ''}</span>
          </div>
          {txLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="ml-2 text-gray-400 text-xs">Loading transactions...</span>
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-gray-500 text-xs sm:text-sm text-center py-6">No transactions yet.</p>
          ) : (
            <>
              <div className="divide-y divide-gray-800/50">
                {transactions.map((tx: any) => {
                  const email = tx.referred_user_email || tx.referred_user || '';
                  const name = tx.referred_user_name || email.split('@')[0] || 'User';
                  const maskedEmail = email ? email.replace(/^(.{2})(.*)(@.*)$/, (m: string, a: string, b: string, c: string) => a + '*'.repeat(Math.min(b.length, 6)) + c) : '';
                  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
                    completed: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', label: 'Earned' },
                    paid: { bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400', label: 'Paid' },
                    pending: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', label: 'Pending' },
                    cancelled: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', label: 'Cancelled' },
                  };
                  const st = statusConfig[tx.status] || statusConfig.pending;
                  return (
                    <div key={tx.id} className="px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        {/* User info */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm sm:text-base font-bold text-cyan-400">{name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm sm:text-base font-semibold truncate">{name}</p>
                            <p className="text-gray-500 text-[10px] sm:text-xs truncate">{maskedEmail}</p>
                            <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5">{new Date(tx.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {/* Stats */}
                        <div className="flex items-center gap-6 sm:gap-10 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-gray-500 text-[10px] sm:text-xs">Purchase</p>
                            <p className="text-white text-sm font-semibold">${tx.purchase_amount.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-500 text-[10px] sm:text-xs">Commission</p>
                            <p className="text-green-400 text-sm font-bold">${tx.commission_amount.toFixed(2)}</p>
                          </div>
                          <div className="text-right min-w-[70px] sm:min-w-[85px]">
                            <span className={`inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold border ${st.bg} ${st.text}`}>
                              {st.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Transaction Pagination */}
              {txTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-cyan-500/10">
                  <p className="text-gray-500 text-[10px] sm:text-xs">Page {txPage} of {txTotalPages}</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setTxPage(p => Math.max(1, p - 1))}
                      disabled={txPage <= 1}
                      className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTxPage(p => Math.min(txTotalPages, p + 1))}
                      disabled={txPage >= txTotalPages}
                      className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
