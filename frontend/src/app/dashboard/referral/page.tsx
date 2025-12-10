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
        params: { username: user?.username }
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
      const response = await axios.post(`${API_URL}/referral/create/`, {
        username: user?.username
      });

      if (response.data.success) {
        fetchReferralData();
      }
    } catch (error) {
      console.error('Error creating referral code:', error);
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p>Loading referral data...</p>
        </div>
      </div>
    );
  }

  if (!referralData?.has_referral) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 text-center border border-gray-700">
            <Gift className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-4">Start Earning with Referrals!</h1>
            <p className="text-gray-400 mb-8">
              Refer friends and earn 10% commission on all their purchases
            </p>
            <button
              onClick={createReferralCode}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-8 py-3 rounded-lg font-bold hover:shadow-lg transition-all"
            >
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Referral Program</h1>
          <p className="text-gray-400">Earn 10% commission on every referral purchase</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-6 border border-green-700/30">
            <DollarSign className="w-8 h-8 text-green-400 mb-2" />
            <p className="text-gray-400 text-sm">Total Earnings</p>
            <p className="text-3xl font-bold text-green-400">${stats.total_earnings.toFixed(2)}</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 rounded-xl p-6 border border-yellow-700/30">
            <TrendingUp className="w-8 h-8 text-yellow-400 mb-2" />
            <p className="text-gray-400 text-sm">Pending</p>
            <p className="text-3xl font-bold text-yellow-400">${stats.pending_earnings.toFixed(2)}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-6 border border-blue-700/30">
            <Users className="w-8 h-8 text-blue-400 mb-2" />
            <p className="text-gray-400 text-sm">Signups</p>
            <p className="text-3xl font-bold text-blue-400">{stats.signups}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl p-6 border border-purple-700/30">
            <Gift className="w-8 h-8 text-purple-400 mb-2" />
            <p className="text-gray-400 text-sm">Purchases</p>
            <p className="text-3xl font-bold text-purple-400">{stats.purchases}</p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">Your Referral Link</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
            />
            <button
              onClick={copyReferralLink}
              className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-all flex items-center gap-2"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Code: <span className="text-yellow-400 font-mono">{referralData.referral_code}</span>
          </p>
        </div>

        {/* Request Payout */}
        {stats.pending_earnings > 0 && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Request Payout</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Amount (USD)</label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="0.00"
                  max={stats.pending_earnings}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Available: ${stats.pending_earnings.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="paypal">PayPal</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="crypto">Cryptocurrency</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {paymentMethod === 'paypal' ? 'PayPal Email' : paymentMethod === 'bank' ? 'Account Number' : 'Wallet Address'}
                </label>
                <input
                  type="text"
                  value={paymentDetails}
                  onChange={(e) => setPaymentDetails(e.target.value)}
                  placeholder={paymentMethod === 'paypal' ? 'email@example.com' : 'Enter details'}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>

            <button
              onClick={requestPayout}
              className="mt-4 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition-all"
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
