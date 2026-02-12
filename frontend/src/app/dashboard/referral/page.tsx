'use client';

import { useState, useEffect } from 'react';
import { useDashboard } from '../context';
import { Copy, Check, DollarSign, Users, TrendingUp, Gift, ExternalLink, MousePointerClick } from 'lucide-react';
import axios from 'axios';

export default function ReferralPage() {
  const { user, API_URL } = useDashboard();
  const [referralData, setReferralData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [paymentDetails, setPaymentDetails] = useState('');

  useEffect(() => {
    if (user) {
      fetchReferralData();
    }
  }, [user]);

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
    const link = `https://markstrades.com?ref=${referralData?.referral_code}`;
    navigator.clipboard.writeText(link);
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

  const stats = referralData.stats;
  const referralLink = `https://markstrades.com?ref=${referralData.referral_code}`;

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

        {/* Referral Link */}
        <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-3 sm:p-4">
          <h2 className="text-sm sm:text-base font-bold mb-2 sm:mb-3 text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Your Referral Link</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={referralLink}
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

        {/* Request Payout */}
        {stats.pending_earnings > 0 && (
          <div className="bg-[#12121a] border border-green-500/20 rounded-xl p-3 sm:p-4">
            <h2 className="text-sm sm:text-base font-bold mb-2 sm:mb-3 text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Request Payout</h2>
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

        {/* Recent Transactions */}
        {referralData.transactions && referralData.transactions.length > 0 && (
          <div className="bg-gradient-to-br from-[#0d1117] to-[#12121a] rounded-2xl border border-cyan-500/20 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-cyan-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <h2 className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Recent Transactions</h2>
              </div>
              <span className="text-[10px] sm:text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{referralData.transactions.length} transaction{referralData.transactions.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-gray-800/50">
              {referralData.transactions.map((tx: any) => {
                const email = tx.referred_user_email || tx.referred_user || '';
                const name = tx.referred_user_name || email.split('@')[0] || 'User';
                const maskedEmail = email ? email.replace(/^(.{2})(.*)(@.*)$/, (m: string, a: string, b: string, c: string) => a + '*'.repeat(Math.min(b.length, 6)) + c) : '';
                const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
                  completed: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', label: 'Completed' },
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
                        </div>
                      </div>
                      {/* Stats */}
                      <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
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
                          <p className="text-gray-600 text-[9px] sm:text-[10px] mt-1">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Payout History */}
        {referralData.payouts && referralData.payouts.length > 0 && (
          <div className="bg-gradient-to-br from-[#0d1117] to-[#12121a] rounded-2xl border border-gray-700/50 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-700/30">
              <h2 className="text-sm sm:text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>Payout History</h2>
            </div>
            <div className="divide-y divide-gray-800/50">
              {referralData.payouts.map((payout: any) => {
                const payoutStatusConfig: Record<string, { bg: string; text: string }> = {
                  completed: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400' },
                  processing: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
                  failed: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400' },
                  pending: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400' },
                };
                const ps = payoutStatusConfig[payout.status] || payoutStatusConfig.pending;
                return (
                  <div key={payout.id} className="px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-white/[0.02] transition-colors">
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
          </div>
        )}
      </div>
    </div>
  );
}
