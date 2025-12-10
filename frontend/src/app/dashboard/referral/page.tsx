'use client';

import { useState, useEffect } from 'react';
import { useDashboard } from '../context';
import { Copy, Check, DollarSign, Users, TrendingUp, Gift, ExternalLink } from 'lucide-react';
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
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

          <div className="bg-[#12121a] border border-cyan-500/20 rounded-lg p-1.5 sm:p-3 hover:border-cyan-500/40 transition-all">
            <Users className="w-4 h-4 sm:w-6 sm:h-6 text-cyan-400 mb-1 sm:mb-2" />
            <p className="text-gray-500 text-[10px] sm:text-xs mb-0.5">Signups</p>
            <p className="text-sm sm:text-xl lg:text-2xl font-bold text-cyan-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>{stats.signups}</p>
          </div>

          <div className="bg-[#12121a] border border-purple-500/20 rounded-lg p-1.5 sm:p-3 hover:border-purple-500/40 transition-all">
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
                  <option value="paypal">PayPal</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="crypto">Cryptocurrency</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs text-gray-400 mb-1">
                  {paymentMethod === 'paypal' ? 'PayPal Email' : paymentMethod === 'bank' ? 'Account Number' : 'Wallet Address'}
                </label>
                <input
                  type="text"
                  value={paymentDetails}
                  onChange={(e) => setPaymentDetails(e.target.value)}
                  placeholder={paymentMethod === 'paypal' ? 'email@example.com' : 'Enter details'}
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
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">User</th>
                    <th className="text-left py-3 px-4 text-gray-400">Purchase</th>
                    <th className="text-left py-3 px-4 text-gray-400">Commission</th>
                    <th className="text-left py-3 px-4 text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {referralData.transactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-gray-800">
                      <td className="py-3 px-4">{tx.referred_user}</td>
                      <td className="py-3 px-4">${tx.purchase_amount.toFixed(2)}</td>
                      <td className="py-3 px-4 text-green-400 font-bold">${tx.commission_amount.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          tx.status === 'paid' ? 'bg-green-900 text-green-400' :
                          tx.status === 'approved' ? 'bg-blue-900 text-blue-400' :
                          'bg-yellow-900 text-yellow-400'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payout History */}
        {referralData.payouts && referralData.payouts.length > 0 && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Payout History</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">Amount</th>
                    <th className="text-left py-3 px-4 text-gray-400">Method</th>
                    <th className="text-left py-3 px-4 text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 text-gray-400">Requested</th>
                    <th className="text-left py-3 px-4 text-gray-400">Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {referralData.payouts.map((payout: any) => (
                    <tr key={payout.id} className="border-b border-gray-800">
                      <td className="py-3 px-4 font-bold">${payout.amount.toFixed(2)}</td>
                      <td className="py-3 px-4 capitalize">{payout.payment_method}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          payout.status === 'completed' ? 'bg-green-900 text-green-400' :
                          payout.status === 'processing' ? 'bg-blue-900 text-blue-400' :
                          payout.status === 'failed' ? 'bg-red-900 text-red-400' :
                          'bg-yellow-900 text-yellow-400'
                        }`}>
                          {payout.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {new Date(payout.requested_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {payout.processed_at ? new Date(payout.processed_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
