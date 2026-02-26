'use client';

import { useState, useEffect } from 'react';
import { useDashboard } from '../../context';
import { useRouter } from 'next/navigation';
import {
  Trophy, TrendingUp, Star, Users, ArrowLeft, Medal, Crown, Award,
  ChevronUp, ChevronDown, BarChart3, Clock
} from 'lucide-react';

type SortKey = 'profit' | 'rating' | 'subscribers';

export default function FMLeaderboardPage() {
  const { API_URL } = useDashboard();
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('profit');
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy]);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/fund-managers/leaderboard/?sort_by=${sortBy}`);
      const data = await res.json();
      if (data.success) setLeaderboard(data.leaderboard);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-gray-500 font-bold text-sm w-6 text-center">#{rank}</span>;
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 border-yellow-500/30';
    if (rank === 2) return 'bg-gradient-to-r from-gray-400/10 to-gray-400/5 border-gray-400/30';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600/10 to-amber-600/5 border-amber-600/30';
    return 'bg-[#12121a] border-cyan-500/10';
  };

  return (
    <div className="max-w-5xl mx-auto px-1 sm:px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/dashboard/fund-managers')} className="text-cyan-400 hover:text-cyan-300 text-sm mb-2 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to FM Engine
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <Trophy className="w-7 h-7 text-yellow-400" /> FM Engine Leaderboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">Top performing fund managers in the community ranked by performance</p>
        </div>
      </div>

      {/* Sort Tabs */}
      <div className="flex gap-1 mb-6 bg-[#12121a] p-1 rounded-lg border border-cyan-500/10 w-fit">
        {([
          { key: 'profit' as SortKey, label: 'Profit', icon: TrendingUp },
          { key: 'rating' as SortKey, label: 'Rating', icon: Star },
          { key: 'subscribers' as SortKey, label: 'Subscribers', icon: Users },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setSortBy(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition ${
              sortBy === tab.key ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-20 bg-[#12121a] border border-cyan-500/10 rounded-xl">
          <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No fund managers on the leaderboard yet</p>
        </div>
      ) : (
        <>
          {/* Desktop: List/Table View */}
          <div className="hidden md:block space-y-2">
            <div className="grid grid-cols-12 gap-3 px-4 py-2 text-gray-500 text-xs font-medium uppercase">
              <div className="col-span-1">Rank</div>
              <div className="col-span-4">Fund Manager</div>
              <div className="col-span-2 text-right">Profit</div>
              <div className="col-span-2 text-right">Rating</div>
              <div className="col-span-1 text-right">Subs</div>
              <div className="col-span-2 text-right">Win Rate</div>
            </div>

            {leaderboard.map((fm: any, index: number) => {
              const rank = index + 1;
              return (
                <button
                  key={fm.id}
                  onClick={() => router.push(`/dashboard/fund-managers/${fm.id}`)}
                  className={`w-full grid grid-cols-12 gap-3 items-center px-4 py-4 rounded-xl border transition hover:scale-[1.005] ${getRankBg(rank)}`}
                >
                  <div className="col-span-1 flex justify-center">
                    {getRankIcon(rank)}
                  </div>
                  <div className="col-span-4 flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                      {fm.avatar_url ? (
                        <img src={fm.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        fm.display_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-medium text-sm flex items-center gap-1 truncate">
                        {fm.display_name}
                        {fm.is_verified && <Award className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                      </div>
                      <div className="text-gray-500 text-xs truncate mb-1">{fm.trading_style} · {fm.months_active}mo active</div>
                      {fm.join_label && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300">
                          <Clock className="w-2.5 h-2.5" />{fm.join_label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={`font-bold text-sm ${parseFloat(fm.total_profit_percent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {parseFloat(fm.total_profit_percent) >= 0 ? '+' : ''}{fm.total_profit_percent}%
                    </span>
                  </div>
                  <div className="col-span-2 text-right flex items-center justify-end gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-medium text-sm">{fm.average_rating}</span>
                    <span className="text-gray-600 text-xs">({fm.total_reviews})</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-cyan-400 font-medium text-sm">{fm.subscriber_count}</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-12 bg-gray-800 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, parseFloat(fm.win_rate))}%` }} />
                      </div>
                      <span className="text-white text-xs font-medium">{fm.win_rate}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile: Grid Cards */}
          <div className="grid grid-cols-2 gap-2 md:hidden">
            {leaderboard.map((fm: any, index: number) => {
              const rank = index + 1;
              return (
                <button
                  key={fm.id}
                  onClick={() => router.push(`/dashboard/fund-managers/${fm.id}`)}
                  className={`relative text-left rounded-xl border p-3 transition ${getRankBg(rank)}`}
                >
                  <div className="absolute top-2 right-2">
                    {getRankIcon(rank)}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm mb-2">
                    {fm.avatar ? (
                      <img src={fm.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      fm.display_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="text-white font-medium text-xs truncate flex items-center gap-1 mb-0.5">
                    {fm.display_name}
                    {fm.is_verified && <Award className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
                  </div>
                  <div className="text-gray-500 text-[10px] mb-2">{fm.trading_style}</div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                    <div>
                      <span className="text-gray-500">Profit</span>
                      <div className={`font-bold ${parseFloat(fm.total_profit_percent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(fm.total_profit_percent) >= 0 ? '+' : ''}{fm.total_profit_percent}%
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Win</span>
                      <div className="text-white font-bold">{fm.win_rate}%</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Rating</span>
                      <div className="flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-white font-bold">{fm.average_rating}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Subs</span>
                      <div className="text-cyan-400 font-bold">{fm.subscriber_count}</div>
                    </div>
                  </div>

                  {fm.join_label && (
                    <div className="mt-2 pt-2 border-t border-gray-800">
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300">
                        <Clock className="w-2.5 h-2.5" />{fm.join_label}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
