'use client';

import { useState, useEffect } from 'react';
import { useDashboard } from '../context';
import { useRouter } from 'next/navigation';
import { Star, Users, TrendingUp, Shield, Crown, Search, Zap, Clock, ChevronLeft, ChevronRight, ArrowUpDown, CheckCircle } from 'lucide-react';

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  standard: { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30' },
  professional: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  elite: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
};

const PAGE_SIZE = 8;

export default function FundManagersPage() {
  const { API_URL, user } = useDashboard();
  const router = useRouter();
  const [fundManagers, setFundManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [isApprovedFM, setIsApprovedFM] = useState(false);
  const [fmStatus, setFmStatus] = useState<string | null>(null); // 'pending' | 'approved' | etc
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchFundManagers();
  }, [sortBy]);

  useEffect(() => {
    if (!user?.email) return;
    const checkFMStatus = async () => {
      try {
        // GET request — returns success:true only for approved FMs
        const res = await fetch(`${API_URL}/fund-managers/dashboard/?email=${encodeURIComponent(user.email)}`);
        const data = await res.json();
        if (data.success) {
          setIsApprovedFM(true);
          setFmStatus('approved');
        } else {
          // Check if they have a pending/rejected application
          const applyRes = await fetch(`${API_URL}/fund-managers/apply/?check=1&email=${encodeURIComponent(user.email)}`);
          const applyData = await applyRes.json();
          if (applyData.status) setFmStatus(applyData.status);
        }
      } catch {}
    };
    checkFMStatus();
  }, [user]);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [searchQuery]);

  const fetchFundManagers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/fund-managers/?sort=${sortBy}`);
      const data = await res.json();
      if (data.success) setFundManagers(data.fund_managers);
    } catch (err) {
      console.error('Failed to fetch fund managers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = fundManagers.filter(fm => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return fm.display_name.toLowerCase().includes(q) ||
      (fm.trading_style || '').toLowerCase().includes(q) ||
      fm.trading_pairs.toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const renderStars = (rating: string | number) => {
    const r = Math.round(parseFloat(String(rating)));
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-3 h-3 ${i < r ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'}`} />
    ));
  };

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          FM Engine
        </h1>
        <p className="text-gray-400 text-xs sm:text-sm">
          Hire a verified fund manager to remotely control your EA — so you never miss a good session or overtrade a bad one.
        </p>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => router.push('/dashboard/fund-managers/leaderboard')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-lg text-xs font-medium border border-yellow-500/20 hover:bg-yellow-500/20 transition"
        >
          <Crown className="w-3.5 h-3.5" /> Leaderboard
        </button>
        {isApprovedFM ? (
          <button
            onClick={() => router.push('/dashboard/fund-managers/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium border border-green-500/20 hover:bg-green-500/20 transition"
          >
            <CheckCircle className="w-3.5 h-3.5" /> My FM Dashboard
          </button>
        ) : fmStatus === 'pending' ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-lg text-xs font-medium border border-yellow-500/20">
            <Clock className="w-3.5 h-3.5" /> Application Pending
          </span>
        ) : (
          <button
            onClick={() => router.push('/dashboard/fund-managers/apply')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-medium border border-purple-500/20 hover:bg-purple-500/20 transition"
          >
            <Zap className="w-3.5 h-3.5" /> Become an FM
          </button>
        )}
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, style, or trading pair…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a2e] border border-cyan-500/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setPage(1); }}
            className="bg-[#1a1a2e] border border-cyan-500/20 rounded-lg text-white text-sm px-3 py-2.5 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="featured">Featured</option>
            <option value="rating">Top Rated</option>
            <option value="subscribers">Most Popular</option>
            <option value="profit">Highest Profit</option>
            <option value="price_low">Price: Low → High</option>
            <option value="price_high">Price: High → Low</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <div className="text-gray-500 text-xs mb-3">
          {filtered.length} fund manager{filtered.length !== 1 ? 's' : ''} found
          {searchQuery && ` for "${searchQuery}"`}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
        </div>
      )}

      {/* Desktop: List Header */}
      {!loading && paginated.length > 0 && (
        <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 text-gray-600 text-[10px] font-semibold uppercase tracking-wider mb-1">
          <div className="col-span-4">Fund Manager</div>
          <div className="col-span-1 text-right">Profit</div>
          <div className="col-span-1 text-right">Win</div>
          <div className="col-span-2 text-right">Rating</div>
          <div className="col-span-1 text-right">Subs</div>
          <div className="col-span-1 text-right">Style</div>
          <div className="col-span-2 text-right">Price</div>
        </div>
      )}

      {/* FM List */}
      {!loading && (
        <div className="space-y-2">
          {paginated.map(fm => {
            const tier = TIER_COLORS[fm.tier] || TIER_COLORS.standard;
            const profit = parseFloat(fm.total_profit_percent);
            return (
              <div
                key={fm.id}
                className={`bg-[#12121a] border border-cyan-500/10 hover:border-cyan-500/30 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-cyan-500/5 ${fm.is_featured ? 'border-l-2 border-l-yellow-500/60' : ''}`}
              >
                {fm.is_featured && (
                  <div className="bg-gradient-to-r from-yellow-500/15 to-transparent px-3 py-1 flex items-center gap-1.5">
                    <Crown className="w-3 h-3 text-yellow-400" />
                    <span className="text-yellow-300 text-[10px] font-semibold tracking-wider">FEATURED</span>
                  </div>
                )}

                {/* Desktop Row */}
                <div className="hidden sm:grid grid-cols-12 gap-3 items-center px-4 py-3.5">
                  {/* Profile */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/20 flex items-center justify-center flex-shrink-0 border border-cyan-500/20">
                      {fm.avatar_url ? (
                        <img src={fm.avatar_url} alt={fm.display_name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <span className="text-base font-bold text-cyan-400">{fm.display_name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-white font-semibold text-sm truncate">{fm.display_name}</span>
                        {fm.is_verified && <Shield className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.text} border ${tier.border} flex-shrink-0`}>
                          {fm.tier.charAt(0).toUpperCase() + fm.tier.slice(1)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {fm.trading_pairs.split(',').slice(0, 3).map((p: string) => (
                          <span key={p} className="text-[9px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/10">
                            {p.trim()}
                          </span>
                        ))}
                        {fm.trading_pairs.split(',').length > 3 && (
                          <span className="text-[9px] text-gray-500">+{fm.trading_pairs.split(',').length - 3}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Profit */}
                  <div className="col-span-1 text-right">
                    <span className={`font-bold text-sm ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {profit >= 0 ? '+' : ''}{fm.total_profit_percent}%
                    </span>
                  </div>
                  {/* Win Rate */}
                  <div className="col-span-1 text-right">
                    <span className="text-white text-sm font-medium">{fm.win_rate}%</span>
                  </div>
                  {/* Rating */}
                  <div className="col-span-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <div className="flex">{renderStars(fm.average_rating)}</div>
                      <span className="text-gray-500 text-[10px]">({fm.total_reviews})</span>
                    </div>
                  </div>
                  {/* Subs */}
                  <div className="col-span-1 text-right">
                    <span className="text-purple-400 text-sm font-medium">{fm.subscriber_count}</span>
                  </div>
                  {/* Style */}
                  <div className="col-span-1 text-right">
                    <span className="text-gray-400 text-[10px] truncate">{fm.trading_style || '—'}</span>
                  </div>
                  {/* Price + Actions */}
                  <div className="col-span-2 flex flex-col items-end gap-1">
                    <div>
                      <span className="text-white font-bold text-sm">${fm.monthly_price}</span>
                      <span className="text-gray-500 text-[10px]">/mo</span>
                    </div>
                    {fm.trial_days > 0 && (
                      <span className="text-green-400 text-[10px] flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />{fm.trial_days}d trial
                      </span>
                    )}
                    <button
                      onClick={() => router.push(`/dashboard/fund-managers/${fm.id}`)}
                      className="mt-1 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black text-[10px] font-bold px-3 py-1 rounded-lg transition whitespace-nowrap"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      Subscribe
                    </button>
                  </div>
                </div>

                {/* Mobile Row */}
                <div className="sm:hidden flex items-center gap-3 px-3 py-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/20 flex items-center justify-center flex-shrink-0 border border-cyan-500/20">
                    {fm.avatar_url ? (
                      <img src={fm.avatar_url} alt={fm.display_name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-base font-bold text-cyan-400">{fm.display_name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-white font-semibold text-xs truncate">{fm.display_name}</span>
                      {fm.is_verified && <Shield className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={`font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {profit >= 0 ? '+' : ''}{fm.total_profit_percent}%
                      </span>
                      <span className="text-gray-600">·</span>
                      <span className="text-gray-400">Win {fm.win_rate}%</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-white font-bold">${fm.monthly_price}/mo</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex">{renderStars(fm.average_rating)}</div>
                      <span className="text-gray-500 text-[9px]">({fm.total_reviews})</span>
                      {fm.trial_days > 0 && (
                        <span className="text-green-400 text-[9px] ml-1 flex items-center gap-0.5">
                          <Clock className="w-2 h-2" />{fm.trial_days}d trial
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/fund-managers/${fm.id}`)}
                    className="flex-shrink-0 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 text-black text-[10px] font-bold px-3 py-2 rounded-lg transition"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Subscribe
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-20">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white text-lg font-semibold mb-2">No Fund Managers Found</h3>
          <p className="text-gray-400 text-sm">
            {searchQuery ? 'Try adjusting your search.' : 'Fund managers will appear here once approved.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 text-xs rounded-lg transition ${
                  p === page
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
