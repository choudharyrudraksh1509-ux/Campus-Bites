import { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  Store, 
  Users, 
  Activity, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Flame, 
  Shield, 
  Search, 
  ArrowUpRight, 
  Zap, 
  TrendingUp, 
  Coffee, 
  Check, 
  X,
  Sliders,
  DollarSign,
  UserCheck,
  Eye
} from 'lucide-react';
import api from '../services/api';

interface AdminStats {
  summary: {
    totalRevenue: number;
    todayRevenue: number;
    totalOrders: number;
    todayOrders: number;
    activeOrdersCount: number;
    completedOrdersCount: number;
    cancelledOrdersCount: number;
    averageOrderValue: number;
    totalUsers: number;
    totalStaff: number;
    totalOutlets: number;
    totalFoodItems: number;
    dynamicPricingItems: number;
    closingSoonOutletsCount: number;
  };
  stallPerformance: Array<{
    shop_id: number;
    name: string;
    area_name: string;
    status: string;
    isClosingSoon: boolean;
    closingDiscount: number;
    totalOrders: number;
    completedOrders: number;
    activeOrders: number;
    revenue: number;
    avgPrepTime: number;
    staffCount: number;
    staffNames: string[];
    menuItemsCount: number;
  }>;
  hourlyDistribution: Array<{ hour: number; ordersCount: number; revenue: number }>;
  topSellingItems: Array<{
    id: number;
    name: string;
    category_name: string;
    shop_name: string;
    price: number;
    unitsSold: number;
    revenue: number;
  }>;
  paymentStats: Array<{
    method: string;
    count: number;
    revenue: number;
    percentage: number;
  }>;
  statusBreakdown: Record<string, number>;
  dailyTrend: Array<{ date: string; dayLabel: string; ordersCount: number; revenue: number }>;
}

interface LiveOrder {
  id: number;
  shop_id: number;
  shop_name: string;
  area_name: string;
  status: string;
  totalAmount: number;
  orderTime: string;
  isPreorder: boolean;
  pickupTime: string | null;
  estimatedMinutes: number;
  queueNumber: number;
  paymentMethod: string;
  pickup_token: string;
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  items: Array<{
    id: number;
    itemId: number;
    name: string;
    quantity: number;
    priceAtOrder: number;
  }>;
  paymentStatus: string;
}

interface StallItem {
  id: number;
  name: string;
  status: string;
  area_id: number;
  area_name: string;
  isClosingSoon: boolean;
  closingDiscount: number;
  totalOrders: number;
  activeOrders: number;
  revenue: number;
  menuItemsCount: number;
  staff: Array<{ id: number; name: string; email: string; phone: string }>;
}

interface UserItem {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  ordersCount: number;
  assignedShop: string | null;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'live' | 'stalls' | 'users' | 'reports'>('overview');
  
  // Data States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [stalls, setStalls] = useState<StallItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  
  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [liveStatusFilter, setLiveStatusFilter] = useState<string>('ALL');
  const [liveShopFilter, setLiveShopFilter] = useState<string>('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Edit Role Modal
  const [editRoleModal, setEditRoleModal] = useState<{
    isOpen: boolean;
    user: UserItem | null;
    role: string;
    shopId: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    user: null,
    role: 'CUSTOMER',
    shopId: '',
    isSubmitting: false
  });

  const pollIntervalRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch functions
  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    }
  };

  const fetchLiveOrders = async (showLoad = false) => {
    if (showLoad) setIsRefreshing(true);
    try {
      const params: any = {};
      if (liveStatusFilter !== 'ALL') params.status = liveStatusFilter;
      if (liveShopFilter !== 'ALL') params.shopId = liveShopFilter;
      const res = await api.get('/admin/live-orders', { params });
      setLiveOrders(res.data || []);
    } catch (err) {
      console.error('Failed to fetch live orders:', err);
    } finally {
      if (showLoad) setIsRefreshing(false);
    }
  };

  const fetchStalls = async () => {
    try {
      const res = await api.get('/admin/stalls');
      setStalls(res.data || []);
    } catch (err) {
      console.error('Failed to fetch stalls:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const refreshCurrentView = async () => {
    setIsRefreshing(true);
    if (activeTab === 'overview') await fetchStats();
    else if (activeTab === 'live') await fetchLiveOrders();
    else if (activeTab === 'stalls') await fetchStalls();
    else if (activeTab === 'users') await fetchUsers();
    else if (activeTab === 'reports') await fetchStats();
    setIsRefreshing(false);
  };

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchLiveOrders(), fetchStalls(), fetchUsers()])
      .finally(() => setLoading(false));
  }, []);

  // Polling for live kitchen orders
  useEffect(() => {
    if (activeTab === 'live') {
      fetchLiveOrders();
      pollIntervalRef.current = setInterval(() => {
        fetchLiveOrders(false);
      }, 5000);
    } else if (activeTab === 'overview' || activeTab === 'reports') {
      fetchStats();
    } else if (activeTab === 'stalls') {
      fetchStalls();
    } else if (activeTab === 'users') {
      fetchUsers();
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeTab, liveStatusFilter, liveShopFilter]);

  // Order status override
  const handleUpdateOrderStatus = async (orderId: number, targetStatus: string) => {
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: targetStatus });
      showToast(`Order #${orderId} marked as ${targetStatus}`);
      fetchLiveOrders();
      fetchStats();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update order');
    }
  };

  // Stall quick toggle
  const handleToggleStallStatus = async (shopId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
    try {
      await api.patch(`/admin/stalls/${shopId}`, { status: newStatus });
      showToast(`Stall #${shopId} status changed to ${newStatus}`);
      fetchStalls();
      fetchStats();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update stall');
    }
  };

  // Stall closing clearance toggle
  const handleToggleStallClearance = async (shopId: number, isClosingSoon: boolean) => {
    try {
      await api.patch(`/admin/stalls/${shopId}`, {
        isClosingSoon: !isClosingSoon,
        closingDiscount: !isClosingSoon ? 25 : 0
      });
      showToast(`Stall #${shopId} closing clearance ${!isClosingSoon ? 'activated (25% OFF)' : 'deactivated'}`);
      fetchStalls();
      fetchStats();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update stall clearance');
    }
  };

  // Save Role Modal
  const handleSaveUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoleModal.user) return;
    setEditRoleModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await api.patch(`/admin/users/${editRoleModal.user.id}/role`, {
        role: editRoleModal.role,
        shopId: editRoleModal.role === 'STAFF' && editRoleModal.shopId ? Number(editRoleModal.shopId) : undefined
      });
      showToast(`Permissions updated for ${editRoleModal.user.fullName}`);
      setEditRoleModal({ isOpen: false, user: null, role: 'CUSTOMER', shopId: '', isSubmitting: false });
      fetchUsers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update role');
      setEditRoleModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Inject fresh real-time simulated orders
  const handleInjectRealtimeData = async () => {
    setIsInjecting(true);
    try {
      const res = await api.post('/admin/seed-realtime-data');
      showToast(res.data?.message || 'Fresh live operational data generated!');
      await Promise.all([fetchStats(), fetchLiveOrders(), fetchStalls()]);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to seed real-time data');
    } finally {
      setIsInjecting(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const matchesSearch = !userSearch || 
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.phone && u.phone.includes(userSearch));
    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 pb-20">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-6 z-50 bg-[#1D1D21] border border-[#FF004B]/60 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Tech Team Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#4C1829] via-[#33111C] to-[#1D1D21] border border-[#930E36]/80 p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-15 pointer-events-none mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF004B]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 font-bold">
                <Shield size={12} className="text-red-400" />
                <span>Tech Team Operations Hub</span>
              </span>
              <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-full font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Sync Active</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Campus Bites Admin Console
            </h1>
            <p className="text-xs sm:text-sm text-white/70 max-w-2xl mt-1">
              Real-time platform statistics, 9-outlet live kitchen queue monitoring, calculated revenue reports, and user access management.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleInjectRealtimeData}
              disabled={isInjecting}
              className="bg-gradient-to-r from-red-600 to-[#FF004B] hover:from-red-500 hover:to-[#FF2666] text-white px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-2 shadow-lg shadow-red-900/40 active:scale-95 disabled:opacity-50"
              title="Populate live simulated campus orders"
            >
              <Zap size={14} className={isInjecting ? 'animate-bounce' : ''} />
              <span>{isInjecting ? 'Injecting Orders...' : '⚡ Inject Live Orders'}</span>
            </button>

            <button
              onClick={refreshCurrentView}
              disabled={isRefreshing}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#FF004B]' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="relative z-10 flex space-x-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'overview', label: 'Overview & Metrics', icon: BarChart3 },
            { id: 'live', label: 'Live Kitchen Monitor', icon: Activity, badge: stats?.summary.activeOrdersCount },
            { id: 'stalls', label: 'Outlets (9 Stalls)', icon: Store },
            { id: 'users', label: 'Users & Permissions', icon: Users },
            { id: 'reports', label: 'Calculated Reports', icon: TrendingUp }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#930E36] to-[#B31242] text-white border border-[#FF004B]/60 shadow-lg shadow-[#930E36]/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-white/50'} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-black">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: OVERVIEW & PLATFORM METRICS */}
      {/* ==================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Key KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            
            {/* Total Revenue */}
            <div className="bg-[#1D1D21]/90 border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#FF004B]/40 transition-all">
              <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold flex items-center justify-between">
                <span>Total Revenue</span>
                <DollarSign size={14} className="text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1.5 font-mono">
                ₹{stats?.summary.totalRevenue.toLocaleString() || 0}
              </div>
              <div className="text-[10px] text-emerald-400 mt-1 flex items-center space-x-1">
                <ArrowUpRight size={12} />
                <span>+₹{stats?.summary.todayRevenue.toLocaleString() || 0} today</span>
              </div>
            </div>

            {/* Total Orders */}
            <div className="bg-[#1D1D21]/90 border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#FF004B]/40 transition-all">
              <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold flex items-center justify-between">
                <span>Total Orders</span>
                <Activity size={14} className="text-blue-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1.5 font-mono">
                {stats?.summary.totalOrders || 0}
              </div>
              <div className="text-[10px] text-blue-300 mt-1">
                {stats?.summary.todayOrders || 0} orders today
              </div>
            </div>

            {/* Average Order Value (AOV) */}
            <div className="bg-[#1D1D21]/90 border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#FF004B]/40 transition-all">
              <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold flex items-center justify-between">
                <span>Avg Ticket (AOV)</span>
                <TrendingUp size={14} className="text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1.5 font-mono">
                ₹{stats?.summary.averageOrderValue || 0}
              </div>
              <div className="text-[10px] text-white/40 mt-1">
                Across completed meals
              </div>
            </div>

            {/* Live Kitchen Queue */}
            <div className="bg-[#1D1D21]/90 border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#FF004B]/40 transition-all">
              <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold flex items-center justify-between">
                <span>Active Queue</span>
                <Clock size={14} className="text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1.5 font-mono flex items-center space-x-1.5">
                <span>{stats?.summary.activeOrdersCount || 0}</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              </div>
              <div className="text-[10px] text-white/50 mt-1">
                Cooking / Ready
              </div>
            </div>

            {/* Campus Users */}
            <div className="bg-[#1D1D21]/90 border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#FF004B]/40 transition-all">
              <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold flex items-center justify-between">
                <span>Users / Staff</span>
                <Users size={14} className="text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1.5 font-mono">
                {stats?.summary.totalUsers || 0}
              </div>
              <div className="text-[10px] text-purple-300 mt-1">
                {stats?.summary.totalStaff || 0} stall operators
              </div>
            </div>

            {/* Outlets & Clearance */}
            <div className="bg-[#1D1D21]/90 border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#FF004B]/40 transition-all">
              <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold flex items-center justify-between">
                <span>Stalls & Deals</span>
                <Flame size={14} className="text-red-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1.5 font-mono">
                {stats?.summary.totalOutlets || 9}
              </div>
              <div className="text-[10px] text-red-300 mt-1">
                {stats?.summary.dynamicPricingItems || 0} surplus discount items
              </div>
            </div>

          </div>

          {/* Charts Row: 7-Day Trend & Peak Hours */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 7-Day Revenue & Volume Trend */}
            <div className="bg-[#1D1D21]/90 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                    <TrendingUp size={16} className="text-[#FF004B]" />
                    <span>Past 7 Days Revenue Trend</span>
                  </h3>
                  <p className="text-xs text-white/50">Daily campus meal orders and completed transaction volume</p>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg">
                  Real-time Data
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {stats?.dailyTrend && stats.dailyTrend.map((day, idx) => {
                  const maxRev = Math.max(...stats.dailyTrend.map(d => d.revenue), 100);
                  const pct = Math.max(8, Math.round((day.revenue / maxRev) * 100));
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-white/80">{day.dayLabel}</span>
                        <div className="flex items-center space-x-3 font-mono">
                          <span className="text-white/40 text-[11px]">{day.ordersCount} orders</span>
                          <span className="font-bold text-emerald-400">₹{day.revenue.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#930E36] to-[#FF004B] rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Peak Meal Hours Distribution (24h) */}
            <div className="bg-[#1D1D21]/90 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                    <Clock size={16} className="text-amber-400" />
                    <span>Hourly Order Surges (Peak Times)</span>
                  </h3>
                  <p className="text-xs text-white/50">Identifies breakfast, lunch, tea, and dinner rush windows</p>
                </div>
                <span className="text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-lg">
                  Peak: 12-2 PM & 7-9 PM
                </span>
              </div>

              <div className="grid grid-cols-12 gap-1.5 pt-4 h-48 items-end">
                {stats?.hourlyDistribution.slice(8, 23).map((item) => {
                  const maxHourly = Math.max(...stats.hourlyDistribution.map(h => h.ordersCount), 1);
                  const heightPct = Math.max(10, Math.round((item.ordersCount / maxHourly) * 100));
                  const isPeak = item.hour === 12 || item.hour === 13 || item.hour === 20;

                  return (
                    <div key={item.hour} className="flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap z-20 border border-white/20">
                        {item.hour}:00 - {item.ordersCount} orders (₹{item.revenue})
                      </div>

                      <div 
                        className={`w-full rounded-t-lg transition-all ${
                          isPeak 
                            ? 'bg-gradient-to-t from-red-600 to-amber-400 shadow-md shadow-amber-500/20' 
                            : 'bg-white/15 hover:bg-white/30'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[10px] font-mono text-white/40 mt-1.5">{item.hour}h</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/5">
                <span>Morning (8-10 AM)</span>
                <span>Lunch Peak (12-2 PM)</span>
                <span>Evening (5-6 PM)</span>
                <span>Dinner Rush (7-10 PM)</span>
              </div>
            </div>

          </div>

          {/* Bottom Row: Top Selling Items & Payment Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Top 10 Selling Items Leaderboard */}
            <div className="lg:col-span-2 bg-[#1D1D21]/90 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                    <Coffee size={16} className="text-[#FF004B]" />
                    <span>Top Selling Food Items Leaderboard</span>
                  </h3>
                  <p className="text-xs text-white/50">Most ordered meals and drinks ranked by revenue & student volume</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-white/50 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Rank</th>
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3">Outlet</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Units Sold</th>
                      <th className="py-2.5 px-3 rounded-r-lg text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats?.topSellingItems && stats.topSellingItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-[#FF004B]">#{idx + 1}</td>
                        <td className="py-3 px-3 font-semibold text-white">{item.name}</td>
                        <td className="py-3 px-3 text-white/60">{item.shop_name}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-[10px]">
                            {item.category_name}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">{item.unitsSold}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">₹{item.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="bg-[#1D1D21]/90 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <DollarSign size={16} className="text-emerald-400" />
                      <span>Payment Modes</span>
                    </h3>
                    <p className="text-xs text-white/50">Transaction distribution across gateways</p>
                  </div>
                </div>

                <div className="space-y-4 pt-3">
                  {stats?.paymentStats && stats.paymentStats.map((pm, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-white/90">{pm.method.replace(/_/g, ' ')}</span>
                        <span className="font-mono text-white/60">{pm.count} orders ({pm.percentage}%)</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                          style={{ width: `${pm.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 mt-4">
                <div className="text-[11px] text-white/50 uppercase font-semibold">Gateway Integration</div>
                <p className="text-xs text-white/70 mt-1">
                  Razorpay Demo, UPI QR & Net Banking are active. Live payment verification logs are captured with instant receipt token generation.
                </p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: LIVE KITCHEN MONITOR (REAL-TIME STREAM) */}
      {/* ==================================================================== */}
      {activeTab === 'live' && (
        <div className="space-y-5">
          
          {/* Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-[#1D1D21]/90 border border-white/10 p-4 rounded-2xl shadow-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-white/60 mr-1">Status:</span>
              {['ALL', 'PLACED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'].map(st => (
                <button
                  key={st}
                  onClick={() => setLiveStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                    liveStatusFilter === st
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={liveShopFilter}
                onChange={e => setLiveShopFilter(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF004B]"
              >
                <option value="ALL">All 9 Outlets</option>
                {stalls.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <button
                onClick={() => fetchLiveOrders(true)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80"
                title="Refresh Live Orders"
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#FF004B]' : ''} />
              </button>
            </div>
          </div>

          {/* Orders Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveOrders.length === 0 ? (
              <div className="col-span-full py-16 text-center text-white/40 bg-[#1D1D21]/50 border border-white/5 rounded-3xl">
                No orders match the selected status / stall filter. Click "⚡ Inject Live Orders" to generate real-time activity.
              </div>
            ) : (
              liveOrders.map(order => {
                const isPrep = order.status === 'PREPARING';
                const isReady = order.status === 'READY';
                const isPlaced = order.status === 'PLACED';
                const isCompleted = order.status === 'COMPLETED';

                return (
                  <div 
                    key={order.id}
                    className="bg-[#1D1D21]/90 border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between hover:border-white/20 transition-all space-y-4"
                  >
                    <div>
                      {/* Card Header: Token & Status */}
                      <div className="flex items-center justify-between pb-3 border-b border-white/5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-sm bg-white/10 border border-white/20 px-2.5 py-1 rounded-xl text-white">
                            {order.pickup_token}
                          </span>
                          <span className="text-[10px] text-white/40 font-mono">#{order.id}</span>
                        </div>

                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center space-x-1 ${
                          isReady ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' :
                          isPrep ? 'bg-amber-950/60 border-amber-500/50 text-amber-300' :
                          isPlaced ? 'bg-blue-950/60 border-blue-500/50 text-blue-300' :
                          isCompleted ? 'bg-white/5 border-white/10 text-white/50' :
                          'bg-red-950/60 border-red-500/50 text-red-300'
                        }`}>
                          {isPrep && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1 animate-ping" />}
                          <span>{order.status}</span>
                        </span>
                      </div>

                      {/* Outlet & Customer Info */}
                      <div className="pt-2 flex justify-between items-start text-xs">
                        <div>
                          <div className="font-bold text-white text-sm">{order.shop_name}</div>
                          <div className="text-[11px] text-white/40">{order.area_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-white/90">{order.customer?.name}</div>
                          <div className="text-[10px] text-white/40">{order.customer?.phone || order.customer?.email}</div>
                        </div>
                      </div>

                      {/* Ordered Items List */}
                      <div className="mt-3 bg-black/30 rounded-xl p-2.5 border border-white/5 space-y-1.5">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-white/80">
                              <span className="text-[#FF004B] font-bold mr-1.5">{it.quantity}x</span>
                              {it.name}
                            </span>
                            <span className="font-mono text-white/60">₹{it.priceAtOrder * it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Metadata & Status Override Actions */}
                    <div className="pt-3 border-t border-white/5 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-2 text-[11px] text-white/50 font-mono">
                          <Clock size={12} />
                          <span>{new Date(order.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span>{order.paymentMethod}</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-emerald-400">
                          ₹{order.totalAmount}
                        </div>
                      </div>

                      {/* Action buttons to override order status */}
                      <div className="flex items-center gap-1.5 pt-1">
                        {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                          <>
                            {order.status === 'PLACED' && (
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'PREPARING')}
                                className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all"
                              >
                                Mark Preparing
                              </button>
                            )}
                            {order.status === 'PREPARING' && (
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, 'READY')}
                                className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all"
                              >
                                Mark Ready
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'COMPLETED')}
                              className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all"
                            >
                              Complete
                            </button>
                          </>
                        )}
                        {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'CANCELLED')}
                            className="p-1.5 rounded-xl bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 text-red-400 text-[10px] transition-all"
                            title="Cancel Order"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: STALLS MANAGEMENT (9 OUTLETS) */}
      {/* ==================================================================== */}
      {activeTab === 'stalls' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stalls.map(s => (
              <div 
                key={s.id}
                className="bg-[#1D1D21]/90 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between hover:border-white/20 transition-all space-y-4"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono uppercase bg-white/5 border border-white/10 text-white/50 px-2 py-0.5 rounded-lg">
                        Outlet #{s.id}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">{s.name}</h3>
                      <p className="text-xs text-white/50">{s.area_name}</p>
                    </div>

                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                      s.status === 'ACTIVE'
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-950/50 border-red-500/40 text-red-300'
                    }`}>
                      {s.status}
                    </span>
                  </div>

                  {/* Operational Metrics */}
                  <div className="grid grid-cols-3 gap-2 my-4 pt-2 border-t border-white/5 text-center">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                      <div className="text-[10px] text-white/40">Total Sales</div>
                      <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">₹{s.revenue.toLocaleString()}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                      <div className="text-[10px] text-white/40">Orders</div>
                      <div className="text-xs font-mono font-bold text-white mt-0.5">{s.totalOrders}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                      <div className="text-[10px] text-white/40">Menu Items</div>
                      <div className="text-xs font-mono font-bold text-white mt-0.5">{s.menuItemsCount}</div>
                    </div>
                  </div>

                  {/* Staff List */}
                  <div className="text-xs">
                    <span className="text-[11px] text-white/40 uppercase font-semibold">Assigned Staff:</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {s.staff.length > 0 ? (
                        s.staff.map((st, i) => (
                          <span key={i} className="text-[11px] bg-white/5 border border-white/10 text-white/80 px-2 py-0.5 rounded-lg">
                            {st.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-white/30 italic">No staff assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stall Controls */}
                <div className="pt-3 border-t border-white/5 flex gap-2">
                  <button
                    onClick={() => handleToggleStallStatus(s.id, s.status)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
                      s.status === 'ACTIVE'
                        ? 'bg-red-950/30 hover:bg-red-900/40 border-red-800/40 text-red-300'
                        : 'bg-emerald-950/30 hover:bg-emerald-900/40 border-emerald-800/40 text-emerald-300'
                    }`}
                  >
                    {s.status === 'ACTIVE' ? 'Set Offline (Close)' : 'Set Active (Open)'}
                  </button>

                  <button
                    onClick={() => handleToggleStallClearance(s.id, s.isClosingSoon)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border flex items-center space-x-1 ${
                      s.isClosingSoon
                        ? 'bg-amber-500 text-black border-amber-400 font-bold'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70'
                    }`}
                    title="Toggle stall closing clearance sale"
                  >
                    <Flame size={13} className={s.isClosingSoon ? 'text-black' : 'text-amber-400'} />
                    <span>{s.isClosingSoon ? `${s.closingDiscount}% OFF` : 'Clearance'}</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: USERS & PERMISSIONS DIRECTORY */}
      {/* ==================================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-[#1D1D21]/90 border border-white/10 p-4 rounded-2xl shadow-xl">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search user by name, email, or phone..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-white/60">Role:</span>
              {['ALL', 'CUSTOMER', 'STAFF', 'ADMIN'].map(r => (
                <button
                  key={r}
                  onClick={() => setUserRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                    userRoleFilter === r
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#1D1D21]/90 shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-white/50 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-4 px-5">User</th>
                  <th className="py-4 px-5">Role & Access</th>
                  <th className="py-4 px-5">Contact Details</th>
                  <th className="py-4 px-5">Assigned Stall</th>
                  <th className="py-4 px-5 text-right">Orders Placed</th>
                  <th className="py-4 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-white/30">
                      No users match the search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-[#4C1829] border border-[#930E36] flex items-center justify-center font-bold text-white text-xs">
                            {u.fullName ? u.fullName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{u.fullName}</div>
                            <div className="text-[11px] text-white/40">ID #{u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          u.role === 'ADMIN' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                          u.role === 'STAFF' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                          'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-white/80">
                        <div>{u.email}</div>
                        <div className="text-[11px] text-white/40">{u.phone || 'No phone'}</div>
                      </td>
                      <td className="py-3.5 px-5 text-white/70">
                        {u.assignedShop ? (
                          <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white font-medium">
                            {u.assignedShop}
                          </span>
                        ) : (
                          <span className="text-white/30 italic">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-white">
                        {u.ordersCount}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setEditRoleModal({
                            isOpen: true,
                            user: u,
                            role: u.role,
                            shopId: '',
                            isSubmitting: false
                          })}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white text-xs font-semibold transition-all inline-flex items-center space-x-1"
                        >
                          <UserCheck size={12} />
                          <span>Edit Role</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: CALCULATED FINANCIAL & OPERATIONS REPORT */}
      {/* ==================================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-[#1D1D21]/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/5 gap-3">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <BarChart3 size={18} className="text-[#FF004B]" />
                  <span>Campus Platform Comprehensive Report</span>
                </h3>
                <p className="text-xs text-white/50">Detailed operational metrics, revenue realization, and meal volume breakdown</p>
              </div>

              <button
                onClick={handleInjectRealtimeData}
                disabled={isInjecting}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 w-fit"
              >
                <Zap size={13} className="text-amber-400" />
                <span>Simulate Real-time Activity</span>
              </button>
            </div>

            {/* Financial Summary Table */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-white/40 uppercase font-semibold">Gross Platform Revenue</span>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-1">₹{stats?.summary.totalRevenue.toLocaleString()}</div>
                <p className="text-[10px] text-white/50 mt-1">Completed student transactions</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-white/40 uppercase font-semibold">Today's Meal Volume</span>
                <div className="text-2xl font-black text-white font-mono mt-1">{stats?.summary.todayOrders} Orders</div>
                <p className="text-[10px] text-emerald-400 mt-1">₹{stats?.summary.todayRevenue.toLocaleString()} collected today</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-white/40 uppercase font-semibold">Order Completion Rate</span>
                <div className="text-2xl font-black text-blue-400 font-mono mt-1">
                  {stats?.summary.totalOrders ? Math.round(((stats.summary.completedOrdersCount + stats.summary.activeOrdersCount) / stats.summary.totalOrders) * 100) : 100}%
                </div>
                <p className="text-[10px] text-white/50 mt-1">{stats?.summary.cancelledOrdersCount || 0} cancellations</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-white/40 uppercase font-semibold">Surplus Clearance Savings</span>
                <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                  {stats?.summary.dynamicPricingItems || 0} Items
                </div>
                <p className="text-[10px] text-amber-300 mt-1">Discounted before stall closing</p>
              </div>
            </div>

            {/* Outlet Revenue Ranking Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-3">Outlet Revenue & Volume Performance</h4>
              <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/30">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-white/50 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Stall Name</th>
                      <th className="py-3 px-4">Complex</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Orders</th>
                      <th className="py-3 px-4 text-right">Avg Prep Time</th>
                      <th className="py-3 px-4 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats?.stallPerformance.map(sp => (
                      <tr key={sp.shop_id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-bold text-white">{sp.name}</td>
                        <td className="py-3 px-4 text-white/60">{sp.area_name}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sp.status === 'ACTIVE' ? 'bg-emerald-950/60 text-emerald-300' : 'bg-red-950/60 text-red-300'
                          }`}>
                            {sp.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white/80">{sp.totalOrders}</td>
                        <td className="py-3 px-4 text-right font-mono text-amber-300">{sp.avgPrepTime} mins</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">₹{sp.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Edit User Role Modal */}
      {editRoleModal.isOpen && editRoleModal.user && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1D21] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 space-y-4">
            <button
              onClick={() => setEditRoleModal({ isOpen: false, user: null, role: 'CUSTOMER', shopId: '', isSubmitting: false })}
              className="absolute top-5 right-5 text-white/40 hover:text-white p-1 rounded-lg"
            >
              <X size={16} />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-[#930E36]/30 border border-[#930E36]/50 flex items-center justify-center text-[#FF004B]">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">User Permissions</h3>
                <p className="text-xs text-white/50">{editRoleModal.user.fullName} ({editRoleModal.user.email})</p>
              </div>
            </div>

            <form onSubmit={handleSaveUserRole} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">Select Access Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {['CUSTOMER', 'STAFF', 'ADMIN'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setEditRoleModal(prev => ({ ...prev, role: r }))}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                        editRoleModal.role === r
                          ? 'bg-gradient-to-r from-[#930E36] to-[#FF004B] text-white border-[#FF004B]'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {editRoleModal.role === 'STAFF' && (
                <div>
                  <label className="text-xs font-semibold text-white/70 block mb-1">Assign to Stall</label>
                  <select
                    value={editRoleModal.shopId}
                    onChange={e => setEditRoleModal(prev => ({ ...prev, shopId: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                  >
                    <option value="">Select Stall...</option>
                    {stalls.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.area_name})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditRoleModal({ isOpen: false, user: null, role: 'CUSTOMER', shopId: '', isSubmitting: false })}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 py-2.5 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editRoleModal.isSubmitting}
                  className="flex-1 bg-gradient-to-r from-red-600 to-[#FF004B] hover:from-red-500 hover:to-[#FF2666] text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-red-900/30"
                >
                  {editRoleModal.isSubmitting ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
