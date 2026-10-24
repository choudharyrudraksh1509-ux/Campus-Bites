import React, { useState, useEffect, useRef } from 'react';
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
  Eye,
  AlertTriangle,
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  Filter,
  Lock,
  Calendar,
  ChevronDown,
  Power,
  Edit3,
  UserX,
  UtensilsCrossed,
  Trash2
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
  owner_id?: number;
  owner_name?: string;
  owner_email?: string;
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

interface AuditLogItem {
  id: number;
  adminId: number;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
  admin: {
    id: number;
    fullName: string;
    email: string;
  };
}

interface ReportsData {
  period: {
    startDate: string | null;
    endDate: string | null;
    shopId: string;
  };
  summary: {
    totalOrders: number;
    totalVerifiedRevenue: number;
    totalCancelled: number;
    cancellationRate: number;
  };
  ordersPerDay: Array<{
    date: string;
    dayLabel: string;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    verifiedRevenue: number;
  }>;
  outletPerformance: Array<{
    shopId: number;
    shopName: string;
    areaName: string;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    verifiedRevenue: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  verifiedRevenueOverTime: Array<{
    date: string;
    dayLabel: string;
    revenue: number;
  }>;
}

interface AreaItem {
  id: number;
  name: string;
  description?: string;
}

export default function AdminDashboard() {
  // Access control validation from local session
  const currentUser = (() => {
    try {
      const saved = localStorage.getItem('campusbite_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  const [activeTab, setActiveTab] = useState<'overview' | 'live' | 'stalls' | 'users' | 'reports' | 'audit'>('overview');
  
  // Data States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [stalls, setStalls] = useState<StallItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [reportsData, setReportsData] = useState<ReportsData | null>(null);
  
  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Pagination for Live Orders
  const [liveStatusFilter, setLiveStatusFilter] = useState<string>('ALL');
  const [liveShopFilter, setLiveShopFilter] = useState<string>('ALL');
  const [liveSearch, setLiveSearch] = useState('');
  const [livePage, setLivePage] = useState(1);
  const [liveTotalPages, setLiveTotalPages] = useState(1);
  const [liveTotal, setLiveTotal] = useState(0);

  // Filters & Pagination for Users
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userTotal, setUserTotal] = useState(0);

  // Filters & Pagination for Audit Logs
  const [auditEntityFilter, setAuditEntityFilter] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);

  // Filters for Reports
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportShopFilter, setReportShopFilter] = useState('ALL');
  const [reportsLoading, setReportsLoading] = useState(false);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    confirmVariant: 'danger',
    onConfirm: () => {}
  });

  // Create Stall Modal
  const [createStallModal, setCreateStallModal] = useState({
    isOpen: false,
    name: '',
    areaId: '',
    ownerId: '',
    isSubmitting: false,
    error: ''
  });

  // Edit Stall Modal
  const [editStallModal, setEditStallModal] = useState<{
    isOpen: boolean;
    stall: StallItem | null;
    name: string;
    areaId: string;
    status: string;
    isClosingSoon: boolean;
    closingDiscount: number;
    isSubmitting: boolean;
    error: string;
  }>({
    isOpen: false,
    stall: null,
    name: '',
    areaId: '',
    status: 'ACTIVE',
    isClosingSoon: false,
    closingDiscount: 0,
    isSubmitting: false,
    error: ''
  });

  // View Stall Staff Modal
  const [stallStaffModal, setStallStaffModal] = useState<{
    isOpen: boolean;
    stall: StallItem | null;
    staff: any[];
    loading: boolean;
  }>({
    isOpen: false,
    stall: null,
    staff: [],
    loading: false
  });

  // View Stall Menu Modal
  const [stallMenuModal, setStallMenuModal] = useState<{
    isOpen: boolean;
    stall: StallItem | null;
    items: any[];
    loading: boolean;
  }>({
    isOpen: false,
    stall: null,
    items: [],
    loading: false
  });

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

  // 1. Fetch Stats
  const fetchStats = async () => {
    try {
      setErrorMessage(null);
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (err: any) {
      console.error('Failed to fetch admin stats:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to calculate platform statistics');
    }
  };

  // 2. Fetch Live Orders
  const fetchLiveOrders = async (showLoad = false) => {
    if (showLoad) setIsRefreshing(true);
    try {
      setErrorMessage(null);
      const params: any = {
        page: livePage,
        limit: 30
      };
      if (liveStatusFilter !== 'ALL') params.status = liveStatusFilter;
      if (liveShopFilter !== 'ALL') params.shopId = liveShopFilter;
      if (liveSearch.trim()) params.search = liveSearch.trim();

      const res = await api.get('/admin/live-orders', { params });
      if (Array.isArray(res.data)) {
        setLiveOrders(res.data);
        setLiveTotal(res.data.length);
        setLiveTotalPages(1);
      } else {
        setLiveOrders(res.data.orders || []);
        setLiveTotal(res.data.total || 0);
        setLiveTotalPages(res.data.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Failed to fetch live orders:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to fetch live kitchen orders');
    } finally {
      if (showLoad) setIsRefreshing(false);
    }
  };

  // 3. Fetch Stalls & Areas
  const fetchStalls = async () => {
    try {
      setErrorMessage(null);
      const [stallsRes, areasRes] = await Promise.all([
        api.get('/admin/stalls'),
        api.get('/areas').catch(() => ({ data: [] }))
      ]);
      setStalls(stallsRes.data || []);
      setAreas(areasRes.data || []);
    } catch (err: any) {
      console.error('Failed to fetch stalls:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to fetch outlets directory');
    }
  };

  // 4. Fetch Users
  const fetchUsers = async () => {
    try {
      setErrorMessage(null);
      const params: any = {
        page: userPage,
        limit: 15
      };
      if (userRoleFilter !== 'ALL') params.role = userRoleFilter;
      if (userSearch.trim()) params.search = userSearch.trim();

      const res = await api.get('/admin/users', { params });
      if (Array.isArray(res.data)) {
        setUsers(res.data);
        setUserTotal(res.data.length);
        setUserTotalPages(1);
      } else {
        setUsers(res.data.users || []);
        setUserTotal(res.data.total || 0);
        setUserTotalPages(res.data.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to fetch users directory');
    }
  };

  // 5. Fetch Audit Logs
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      setErrorMessage(null);
      const params: any = {
        page: auditPage,
        limit: 15
      };
      if (auditEntityFilter !== 'ALL') params.entity = auditEntityFilter;
      if (auditSearch.trim()) params.search = auditSearch.trim();

      const res = await api.get('/admin/audit-logs', { params });
      setAuditLogs(res.data.logs || []);
      setAuditTotal(res.data.total || 0);
      setAuditTotalPages(res.data.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  // 6. Fetch Reports
  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      setErrorMessage(null);
      const params: any = {};
      if (reportStartDate) params.startDate = reportStartDate;
      if (reportEndDate) params.endDate = reportEndDate;
      if (reportShopFilter !== 'ALL') params.shopId = reportShopFilter;

      const res = await api.get('/admin/reports', { params });
      setReportsData(res.data);
    } catch (err: any) {
      console.error('Failed to fetch reports:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to generate comprehensive reports');
    } finally {
      setReportsLoading(false);
    }
  };

  // Master refresh for active tab
  const refreshCurrentView = async () => {
    setIsRefreshing(true);
    if (activeTab === 'overview') await fetchStats();
    else if (activeTab === 'live') await fetchLiveOrders();
    else if (activeTab === 'stalls') await fetchStalls();
    else if (activeTab === 'users') await fetchUsers();
    else if (activeTab === 'reports') await fetchReports();
    else if (activeTab === 'audit') await fetchAuditLogs();
    setIsRefreshing(false);
  };

  // Initial load
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;

    setLoading(true);
    Promise.all([fetchStats(), fetchLiveOrders(), fetchStalls(), fetchUsers()])
      .finally(() => setLoading(false));
  }, []);

  // Polling for live kitchen orders
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;

    if (activeTab === 'live') {
      fetchLiveOrders();
      pollIntervalRef.current = setInterval(() => {
        fetchLiveOrders(false);
      }, 5000);
    } else if (activeTab === 'overview') {
      fetchStats();
    } else if (activeTab === 'stalls') {
      fetchStalls();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'reports') {
      fetchReports();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeTab, liveStatusFilter, liveShopFilter, liveSearch, livePage, userRoleFilter, userSearch, userPage, auditEntityFilter, auditSearch, auditPage]);

  // Order status override with confirmation
  const promptUpdateOrderStatus = (orderId: number, targetStatus: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Update Order #${orderId}`,
      message: `Are you sure you want to transition Order #${orderId} to status "${targetStatus}"? This change will be permanently logged in the audit registry.`,
      confirmLabel: `Mark as ${targetStatus}`,
      confirmVariant: targetStatus === 'CANCELLED' ? 'danger' : 'primary',
      onConfirm: async () => {
        try {
          await api.patch(`/admin/orders/${orderId}/status`, { status: targetStatus });
          showToast(`Order #${orderId} updated to ${targetStatus}`);
          fetchLiveOrders();
          fetchStats();
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to update order status');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Stall quick toggle with confirmation
  const promptToggleStallStatus = (shopId: number, currentStatus: string, shopName: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setConfirmModal({
      isOpen: true,
      title: `${newStatus === 'INACTIVE' ? 'Deactivate' : 'Activate'} Outlet`,
      message: `Are you sure you want to set "${shopName}" to ${newStatus}? ${newStatus === 'INACTIVE' ? 'Students will not be able to place orders at this stall while offline.' : 'Stall will immediately become available for customer orders.'}`,
      confirmLabel: `Set ${newStatus}`,
      confirmVariant: newStatus === 'INACTIVE' ? 'danger' : 'primary',
      onConfirm: async () => {
        try {
          await api.patch(`/admin/stalls/${shopId}`, { status: newStatus });
          showToast(`Outlet "${shopName}" status changed to ${newStatus}`);
          fetchStalls();
          fetchStats();
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to update stall status');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Stall delete with confirmation
  const promptDeleteStall = (shopId: number, shopName: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Outlet "${shopName}"`,
      message: `Are you sure you want to permanently delete "${shopName}"? This will remove all associated food items and staff linkages.`,
      confirmLabel: 'Delete Outlet',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/stalls/${shopId}`);
          showToast(`Outlet "${shopName}" deleted successfully`);
          fetchStalls();
          fetchStats();
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to delete outlet');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Stall closing clearance toggle
  const handleToggleStallClearance = async (shopId: number, isClosingSoon: boolean) => {
    try {
      await api.patch(`/admin/stalls/${shopId}`, {
        isClosingSoon: !isClosingSoon,
        closingDiscount: !isClosingSoon ? 25 : 0
      });
      showToast(`Outlet closing clearance ${!isClosingSoon ? 'activated (25% OFF)' : 'deactivated'}`);
      fetchStalls();
      fetchStats();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update stall clearance');
    }
  };

  // Create Stall submit handler
  const handleCreateStallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createStallModal.name.trim()) {
      setCreateStallModal(prev => ({ ...prev, error: 'Outlet name is required' }));
      return;
    }
    if (!createStallModal.areaId) {
      setCreateStallModal(prev => ({ ...prev, error: 'Please select a campus complex / area' }));
      return;
    }
    if (!createStallModal.ownerId) {
      setCreateStallModal(prev => ({ ...prev, error: 'Please select an owner user' }));
      return;
    }

    setCreateStallModal(prev => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      const res = await api.post('/admin/stalls', {
        name: createStallModal.name.trim(),
        areaId: Number(createStallModal.areaId),
        ownerId: Number(createStallModal.ownerId)
      });
      showToast(res.data?.message || 'Outlet created successfully!');
      setCreateStallModal({ isOpen: false, name: '', areaId: '', ownerId: '', isSubmitting: false, error: '' });
      fetchStalls();
      fetchStats();
    } catch (err: any) {
      setCreateStallModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err.response?.data?.error || 'Failed to create outlet'
      }));
    }
  };

  // Edit Stall submit handler
  const handleEditStallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStallModal.stall) return;
    if (!editStallModal.name.trim()) {
      setEditStallModal(prev => ({ ...prev, error: 'Outlet name is required' }));
      return;
    }

    setEditStallModal(prev => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      await api.patch(`/admin/stalls/${editStallModal.stall.id}`, {
        name: editStallModal.name.trim(),
        areaId: Number(editStallModal.areaId),
        status: editStallModal.status,
        isClosingSoon: editStallModal.isClosingSoon,
        closingDiscount: Number(editStallModal.closingDiscount)
      });
      showToast(`Outlet "${editStallModal.name}" updated successfully`);
      setEditStallModal(prev => ({ ...prev, isOpen: false, isSubmitting: false }));
      fetchStalls();
      fetchStats();
    } catch (err: any) {
      setEditStallModal(prev => ({
        ...prev,
        isSubmitting: false,
        error: err.response?.data?.error || 'Failed to update outlet'
      }));
    }
  };

  // View Stall Staff
  const handleOpenStallStaff = async (stall: StallItem) => {
    setStallStaffModal({ isOpen: true, stall, staff: [], loading: true });
    try {
      const res = await api.get(`/admin/stalls/${stall.id}/staff`);
      setStallStaffModal(prev => ({ ...prev, staff: res.data || [], loading: false }));
    } catch (err: any) {
      showToast('Failed to load stall staff');
      setStallStaffModal(prev => ({ ...prev, loading: false }));
    }
  };

  // View Stall Menu
  const handleOpenStallMenu = async (stall: StallItem) => {
    setStallMenuModal({ isOpen: true, stall, items: [], loading: true });
    try {
      const res = await api.get(`/admin/stalls/${stall.id}/menu`);
      setStallMenuModal(prev => ({ ...prev, items: res.data || [], loading: false }));
    } catch (err: any) {
      showToast('Failed to load stall menu');
      setStallMenuModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Toggle User Active / Inactive with Confirmation Modal
  const promptToggleUserStatus = (user: UserItem) => {
    const nextStatus = !user.isActive;
    setConfirmModal({
      isOpen: true,
      title: `${nextStatus ? 'Activate' : 'Deactivate'} User Account`,
      message: `Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} account for "${user.fullName}" (${user.email})? ${!nextStatus ? 'Deactivated accounts cannot log in or perform transactions.' : 'User will regain immediate platform access.'}`,
      confirmLabel: nextStatus ? 'Activate User' : 'Deactivate User',
      confirmVariant: nextStatus ? 'primary' : 'danger',
      onConfirm: async () => {
        try {
          await api.patch(`/admin/users/${user.id}/status`, { isActive: nextStatus });
          showToast(`User ${user.fullName} has been ${nextStatus ? 'activated' : 'deactivated'}`);
          fetchUsers();
          fetchStats();
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to update user status');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
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

  // ==========================================================================
  // ACCESS RESTRICTION SCREEN (IF CURRENT USER IS NOT ADMIN)
  // ==========================================================================
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#1D1D21] border border-red-500/40 rounded-3xl p-8 text-center shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-500 shadow-lg shadow-red-900/20">
            <Shield size={32} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40 px-2.5 py-1 rounded-full">
              Access Restricted
            </span>
            <h2 className="text-xl font-extrabold text-white mt-3">Administrator Privileges Required</h2>
            <p className="text-xs text-white/60 mt-2 leading-relaxed">
              The Campus Bites Central Operations Portal is strictly reserved for authorized platform administrators. You are currently logged in with insufficient privileges.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/"
              className="inline-flex items-center justify-center space-x-2 w-full px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-[#FF004B] hover:from-red-500 hover:to-[#FF2666] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-900/40"
            >
              <span>Return to Campus Home</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-6 z-50 bg-[#1D1D21] border border-[#FF004B]/60 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="bg-red-950/40 border border-red-500/50 rounded-2xl p-4 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center space-x-2.5">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={refreshCurrentView}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-xl text-red-300 font-bold uppercase text-[10px] transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top Banner / Operations Hub Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#4C1829] via-[#33111C] to-[#1D1D21] border border-[#930E36]/80 p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-15 pointer-events-none mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF004B]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Campus Bites Admin Console
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleInjectRealtimeData}
              disabled={isInjecting}
              className="bg-gradient-to-r from-red-600 to-[#FF004B] hover:from-red-500 hover:to-[#FF2666] text-white px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-2 shadow-lg shadow-red-900/40 active:scale-95 disabled:opacity-50"
              title="Populate live simulated campus orders"
            >
              <Zap size={14} className={isInjecting ? 'animate-bounce' : ''} />
              <span>{isInjecting ? 'Injecting Orders...' : 'Inject Live Orders'}</span>
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

        {/* Tab Navigation Bar */}
        <div className="relative z-10 flex space-x-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'overview', label: 'Overview & Metrics', icon: BarChart3 },
            { id: 'live', label: 'Live Kitchen Monitor', icon: Activity, badge: stats?.summary.activeOrdersCount },
            { id: 'stalls', label: `Outlets (${stalls.length})`, icon: Store },
            { id: 'users', label: 'Users & Roles', icon: Users },
            { id: 'reports', label: 'Financial Reports', icon: TrendingUp },
            { id: 'audit', label: 'Audit Logs', icon: FileText }
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

      {/* Main Content Area Loading Spinner */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-[#1D1D21]/50 border border-white/5 rounded-3xl">
          <RefreshCw size={28} className="animate-spin text-[#FF004B]" />
          <span className="text-xs text-white/50 font-mono">Loading platform telemetry...</span>
        </div>
      ) : (
        <>
          {/* ==================================================================== */}
          {/* TAB 1: OVERVIEW & PLATFORM METRICS */}
          {/* ==================================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Key KPI Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                
                {/* Verified Total Revenue */}
                <div className="bg-[#1D1D21]/90 border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#FF004B]/40 transition-all">
                  <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold flex items-center justify-between">
                    <span>Verified Revenue</span>
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
                    Completed meal average
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
                    Cooking / Ready now
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
                    {stats?.summary.totalStaff || 0} active staff
                  </div>
                </div>

                {/* Outlets & Clearance */}
                <div className="bg-[#1D1D21]/90 border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-[#FF004B]/40 transition-all">
                  <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold flex items-center justify-between">
                    <span>Active Stalls</span>
                    <Flame size={14} className="text-red-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white mt-1.5 font-mono">
                    {stats?.summary.totalOutlets || 0}
                  </div>
                  <div className="text-[10px] text-red-300 mt-1">
                    {stats?.summary.closingSoonOutletsCount || 0} in clearance sale
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
                        <span>Past 7 Days Verified Revenue Trend</span>
                      </h3>
                      <p className="text-xs text-white/50">Daily campus completed transactions calculated at database level</p>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-lg">
                      Database Verified
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
                        <span>Hourly Order Surges (Today)</span>
                      </h3>
                      <p className="text-xs text-white/50">Real-time identification of breakfast, lunch, and dinner surges</p>
                    </div>
                    <span className="text-[11px] font-mono text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-lg">
                      Peak Windows
                    </span>
                  </div>

                  <div className="grid grid-cols-12 gap-1.5 pt-4 h-48 items-end">
                    {stats?.hourlyDistribution && stats.hourlyDistribution.slice(8, 23).map((item) => {
                      const maxHourly = Math.max(...stats.hourlyDistribution.map(h => h.ordersCount), 1);
                      const heightPct = Math.max(10, Math.round((item.ordersCount / maxHourly) * 100));
                      const isPeak = item.hour === 12 || item.hour === 13 || item.hour === 20;

                      return (
                        <div key={item.hour} className="flex flex-col items-center h-full justify-end group relative">
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
                        {stats?.topSellingItems && stats.topSellingItems.length > 0 ? (
                          stats.topSellingItems.map((item, idx) => (
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
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-white/40">No completed orders recorded yet.</td>
                          </tr>
                        )}
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
                    <div className="text-[11px] text-white/50 uppercase font-semibold">Payment Integrity</div>
                    <p className="text-xs text-white/70 mt-1">
                      Revenue is strictly validated from completed orders with confirmed payment verification records.
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
                
                {/* Search live orders by token or customer */}
                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search by Order # or Customer..."
                    value={liveSearch}
                    onChange={e => {
                      setLiveSearch(e.target.value);
                      setLivePage(1);
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-white/60 mr-1">Status:</span>
                  {['ALL', 'PLACED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'].map(st => (
                    <button
                      key={st}
                      onClick={() => {
                        setLiveStatusFilter(st);
                        setLivePage(1);
                      }}
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
                    onChange={e => {
                      setLiveShopFilter(e.target.value);
                      setLivePage(1);
                    }}
                    className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                  >
                    <option value="ALL">All Outlets</option>
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
                  <div className="col-span-full py-16 text-center text-white/40 bg-[#1D1D21]/50 border border-white/5 rounded-3xl space-y-3">
                    <UtensilsCrossed size={36} className="mx-auto text-white/20" />
                    <p className="text-xs">No orders match the selected filter. Click "Inject Live Orders" to generate realistic campus orders.</p>
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

                          {/* Action buttons to override order status with state machine verification */}
                          <div className="flex items-center gap-1.5 pt-1">
                            {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                              <>
                                {order.status === 'PLACED' && (
                                  <button
                                    onClick={() => promptUpdateOrderStatus(order.id, 'PREPARING')}
                                    className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all"
                                  >
                                    Mark Preparing
                                  </button>
                                )}
                                {order.status === 'PREPARING' && (
                                  <button
                                    onClick={() => promptUpdateOrderStatus(order.id, 'READY')}
                                    className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all"
                                  >
                                    Mark Ready
                                  </button>
                                )}
                                {order.status === 'READY' && (
                                  <button
                                    onClick={() => promptUpdateOrderStatus(order.id, 'COMPLETED')}
                                    className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all"
                                  >
                                    Complete
                                  </button>
                                )}
                              </>
                            )}
                            {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                              <button
                                onClick={() => promptUpdateOrderStatus(order.id, 'CANCELLED')}
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
          {/* TAB 3: STALLS MANAGEMENT (OUTLET DIRECTORY & CONTROLS) */}
          {/* ==================================================================== */}
          {activeTab === 'stalls' && (
            <div className="space-y-5">
              
              {/* Outlet Management Header Action */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1D1D21]/90 border border-white/10 p-4 rounded-2xl gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Campus Outlets Governance</h3>
                  <p className="text-xs text-white/50">Manage operational parameters, assigned staff, menu listings, and clearance promotions</p>
                </div>
                <button
                  onClick={() => setCreateStallModal(prev => ({ ...prev, isOpen: true, error: '' }))}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-[#FF004B] hover:from-red-500 hover:to-[#FF2666] text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-lg shadow-red-900/30"
                >
                  <Plus size={14} />
                  <span>Create New Outlet</span>
                </button>
              </div>

              {/* Stalls Cards Grid */}
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
                          {s.owner_name && (
                            <p className="text-[11px] text-white/40 mt-0.5">Owner: {s.owner_name}</p>
                          )}
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
                          <div className="text-[10px] text-white/40">Verified Revenue</div>
                          <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">₹{s.revenue.toLocaleString()}</div>
                        </div>
                        <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                          <div className="text-[10px] text-white/40">Total Orders</div>
                          <div className="text-xs font-mono font-bold text-white mt-0.5">{s.totalOrders}</div>
                        </div>
                        <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                          <div className="text-[10px] text-white/40">Menu Items</div>
                          <div className="text-xs font-mono font-bold text-white mt-0.5">{s.menuItemsCount}</div>
                        </div>
                      </div>

                      {/* Sub-actions: View Staff & View Menu */}
                      <div className="flex items-center gap-2 pt-1 pb-2">
                        <button
                          onClick={() => handleOpenStallStaff(s)}
                          className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/80 font-medium transition-all"
                        >
                          Staff ({s.staff.length})
                        </button>
                        <button
                          onClick={() => handleOpenStallMenu(s)}
                          className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/80 font-medium transition-all"
                        >
                          Menu ({s.menuItemsCount})
                        </button>
                      </div>
                    </div>

                    {/* Stall Controls & Edit Button */}
                    <div className="pt-3 border-t border-white/5 space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => promptToggleStallStatus(s.id, s.status, s.name)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
                            s.status === 'ACTIVE'
                              ? 'bg-red-950/30 hover:bg-red-900/40 border-red-800/40 text-red-300'
                              : 'bg-emerald-950/30 hover:bg-emerald-900/40 border-emerald-800/40 text-emerald-300'
                          }`}
                        >
                          {s.status === 'ACTIVE' ? 'Set Inactive' : 'Activate'}
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

                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditStallModal({
                            isOpen: true,
                            stall: s,
                            name: s.name,
                            areaId: String(s.area_id),
                            status: s.status,
                            isClosingSoon: s.isClosingSoon,
                            closingDiscount: s.closingDiscount,
                            isSubmitting: false,
                            error: ''
                          })}
                          className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/60 hover:text-white flex items-center justify-center space-x-1 transition-all"
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => promptDeleteStall(s.id, s.name)}
                          className="px-3 py-1.5 rounded-xl bg-red-950/20 hover:bg-red-900/40 border border-red-800/30 text-xs text-red-300 hover:text-red-200 flex items-center justify-center space-x-1 transition-all"
                          title="Delete this outlet"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 4: USERS & PERMISSIONS DIRECTORY (WITH PAGINATION) */}
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
                    onChange={e => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-white/60">Role:</span>
                  {['ALL', 'CUSTOMER', 'STAFF', 'OWNER', 'ADMIN'].map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        setUserRoleFilter(r);
                        setUserPage(1);
                      }}
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
                      <th className="py-4 px-5">Status</th>
                      <th className="py-4 px-5">Assigned Stall</th>
                      <th className="py-4 px-5 text-right">Orders Placed</th>
                      <th className="py-4 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-white/30">
                          No users match the search criteria.
                        </td>
                      </tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-5">
                            <div className="font-bold text-white text-sm">{u.fullName}</div>
                            <div className="text-[11px] text-white/40 font-mono">UID: #{u.id}</div>
                          </td>
                          <td className="py-4 px-5">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                              u.role === 'ADMIN' ? 'bg-red-950/60 border-red-500/50 text-red-300' :
                              u.role === 'STAFF' ? 'bg-amber-950/60 border-amber-500/50 text-amber-300' :
                              u.role === 'OWNER' ? 'bg-purple-950/60 border-purple-500/50 text-purple-300' :
                              'bg-white/5 border-white/10 text-white/70'
                            }`}>
                              {u.role === 'ADMIN' && <Shield size={11} className="text-red-400" />}
                              <span>{u.role}</span>
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            <div className="text-white/80">{u.email}</div>
                            <div className="text-[11px] text-white/40 font-mono">{u.phone || 'No phone'}</div>
                          </td>
                          <td className="py-4 px-5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.isActive ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40' : 'bg-red-950/60 text-red-400 border border-red-800/40'
                            }`}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-white/60">
                            {u.assignedShop || <span className="text-white/20 italic">None</span>}
                          </td>
                          <td className="py-4 px-5 text-right font-mono font-bold text-white">
                            {u.ordersCount}
                          </td>
                          <td className="py-4 px-5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => promptToggleUserStatus(u)}
                              className={`p-1.5 rounded-xl border transition-all ${
                                u.isActive
                                  ? 'bg-red-950/30 hover:bg-red-900/40 border-red-800/40 text-red-400'
                                  : 'bg-emerald-950/30 hover:bg-emerald-900/40 border-emerald-800/40 text-emerald-300'
                              }`}
                              title={u.isActive ? 'Deactivate User' : 'Activate User'}
                            >
                              <Power size={13} />
                            </button>

                            <button
                              onClick={() => setEditRoleModal({
                                isOpen: true,
                                user: u,
                                role: u.role,
                                shopId: '',
                                isSubmitting: false
                              })}
                              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[11px] font-semibold transition-all"
                            >
                              Edit Role
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* User Pagination Bar */}
                <div className="flex items-center justify-between p-4 border-t border-white/5 text-xs text-white/60">
                  <div>
                    Showing {users.length} of {userTotal} users (Page {userPage} of {userTotalPages})
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      disabled={userPage <= 1}
                      onClick={() => setUserPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1 text-white"
                    >
                      <ChevronLeft size={14} />
                      <span>Prev</span>
                    </button>
                    <span className="font-mono px-2 text-white/80">{userPage}</span>
                    <button
                      disabled={userPage >= userTotalPages}
                      onClick={() => setUserPage(p => p + 1)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1 text-white"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 5: CALCULATED FINANCIAL & OPERATIONS REPORT */}
          {/* ==================================================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-[#1D1D21]/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                
                {/* Reports Header & Filter Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/5 gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <BarChart3 size={18} className="text-[#FF004B]" />
                      <span>Financial & Operations Aggregated Report</span>
                    </h3>
                    <p className="text-xs text-white/50">Comprehensive revenue realization, orders per day, and outlet performance metrics</p>
                  </div>

                  {/* Date and Outlet Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={e => setReportStartDate(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                      title="Start Date"
                    />
                    <span className="text-white/40 text-xs">to</span>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={e => setReportEndDate(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                      title="End Date"
                    />
                    <select
                      value={reportShopFilter}
                      onChange={e => setReportShopFilter(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                    >
                      <option value="ALL">All Outlets</option>
                      {stalls.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={fetchReports}
                      disabled={reportsLoading}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all flex items-center space-x-1"
                    >
                      <RefreshCw size={12} className={reportsLoading ? 'animate-spin' : ''} />
                      <span>Apply</span>
                    </button>
                  </div>
                </div>

                {reportsLoading ? (
                  <div className="py-16 text-center text-white/40">
                    <RefreshCw size={24} className="animate-spin mx-auto text-[#FF004B] mb-2" />
                    <span>Aggregating financial report data...</span>
                  </div>
                ) : reportsData ? (
                  <>
                    {/* Financial Summary Table */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[11px] text-white/40 uppercase font-semibold">Verified Platform Revenue</span>
                        <div className="text-2xl font-black text-emerald-400 font-mono mt-1">₹{reportsData.summary.totalVerifiedRevenue.toLocaleString()}</div>
                        <p className="text-[10px] text-white/50 mt-1">Confirmed successful transactions</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[11px] text-white/40 uppercase font-semibold">Total Order Volume</span>
                        <div className="text-2xl font-black text-white font-mono mt-1">{reportsData.summary.totalOrders} Orders</div>
                        <p className="text-[10px] text-emerald-400 mt-1">Within selected date range</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[11px] text-white/40 uppercase font-semibold">Cancellation Rate</span>
                        <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                          {reportsData.summary.cancellationRate}%
                        </div>
                        <p className="text-[10px] text-white/50 mt-1">{reportsData.summary.totalCancelled} cancelled/failed</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                        <span className="text-[11px] text-white/40 uppercase font-semibold">Average Order Realization</span>
                        <div className="text-2xl font-black text-blue-400 font-mono mt-1">
                          ₹{reportsData.summary.totalOrders > 0 ? Math.round(reportsData.summary.totalVerifiedRevenue / reportsData.summary.totalOrders) : 0}
                        </div>
                        <p className="text-[10px] text-blue-300 mt-1">Average per customer ticket</p>
                      </div>
                    </div>

                    {/* Orders Per Day Table */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-3">Daily Order Volume & Verified Revenue</h4>
                      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/30">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-white/5 text-white/50 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4 text-right">Total Orders</th>
                              <th className="py-3 px-4 text-right">Completed</th>
                              <th className="py-3 px-4 text-right">Cancelled</th>
                              <th className="py-3 px-4 text-right">Verified Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {reportsData.ordersPerDay.length > 0 ? (
                              reportsData.ordersPerDay.map(d => (
                                <tr key={d.date} className="hover:bg-white/[0.02]">
                                  <td className="py-3 px-4 font-bold text-white">{d.dayLabel} <span className="text-white/40 text-[10px]">({d.date})</span></td>
                                  <td className="py-3 px-4 text-right font-mono text-white/80">{d.totalOrders}</td>
                                  <td className="py-3 px-4 text-right font-mono text-emerald-400">{d.completedOrders}</td>
                                  <td className="py-3 px-4 text-right font-mono text-red-400">{d.cancelledOrders}</td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">₹{d.verifiedRevenue.toLocaleString()}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-6 text-center text-white/30">No daily records for the selected period.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Outlet Revenue Ranking Table */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-3">Outlet Volume & Performance Breakdown</h4>
                      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/30">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-white/5 text-white/50 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="py-3 px-4">Stall Name</th>
                              <th className="py-3 px-4">Complex</th>
                              <th className="py-3 px-4 text-right">Orders</th>
                              <th className="py-3 px-4 text-right">Completed</th>
                              <th className="py-3 px-4 text-right">Cancelled</th>
                              <th className="py-3 px-4 text-right">Verified Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {reportsData.outletPerformance.map(op => (
                              <tr key={op.shopId} className="hover:bg-white/[0.02]">
                                <td className="py-3 px-4 font-bold text-white">{op.shopName}</td>
                                <td className="py-3 px-4 text-white/60">{op.areaName}</td>
                                <td className="py-3 px-4 text-right font-mono text-white/80">{op.totalOrders}</td>
                                <td className="py-3 px-4 text-right font-mono text-emerald-300">{op.completedOrders}</td>
                                <td className="py-3 px-4 text-right font-mono text-red-400">{op.cancelledOrders}</td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">₹{op.verifiedRevenue.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-white/40">Failed to load reports. Click Apply to retry.</div>
                )}

              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 6: STRUCTURED AUDIT LOGS REGISTRY */}
          {/* ==================================================================== */}
          {activeTab === 'audit' && (
            <div className="space-y-5">
              
              {/* Audit Search & Entity Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-[#1D1D21]/90 border border-white/10 p-4 rounded-2xl shadow-xl">
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search action or details..."
                    value={auditSearch}
                    onChange={e => {
                      setAuditSearch(e.target.value);
                      setAuditPage(1);
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-white/60">Entity:</span>
                  {['ALL', 'SHOP', 'USER', 'ORDER', 'SYSTEM'].map(ent => (
                    <button
                      key={ent}
                      onClick={() => {
                        setAuditEntityFilter(ent);
                        setAuditPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                        auditEntityFilter === ent
                          ? 'bg-white text-black font-bold shadow-md'
                          : 'bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      {ent}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audit Logs Table */}
              <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#1D1D21]/90 shadow-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-white/50 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-4 px-5">Timestamp</th>
                      <th className="py-4 px-5">Administrator</th>
                      <th className="py-4 px-5">Action</th>
                      <th className="py-4 px-5">Target Entity</th>
                      <th className="py-4 px-5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {auditLoading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-white/40">
                          <RefreshCw size={20} className="animate-spin mx-auto text-[#FF004B] mb-2" />
                          <span>Loading audit records...</span>
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-white/30">
                          No audit log entries recorded for this filter.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-5 font-mono text-white/60 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-4 px-5">
                            <div className="font-semibold text-white">{log.admin?.fullName || `Admin #${log.adminId}`}</div>
                            <div className="text-[10px] text-white/40">{log.admin?.email}</div>
                          </td>
                          <td className="py-4 px-5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#930E36]/30 border border-[#930E36]/50 text-[#FF004B]">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            <span className="text-white/80 font-mono">
                              {log.entity} {log.entityId ? `#${log.entityId}` : ''}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-white/70 max-w-md truncate" title={log.details || ''}>
                            {log.details || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Audit Pagination Bar */}
                <div className="flex items-center justify-between p-4 border-t border-white/5 text-xs text-white/60">
                  <div>
                    Showing {auditLogs.length} of {auditTotal} logs (Page {auditPage} of {auditTotalPages})
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1 text-white"
                    >
                      <ChevronLeft size={14} />
                      <span>Prev</span>
                    </button>
                    <span className="font-mono px-2 text-white/80">{auditPage}</span>
                    <button
                      disabled={auditPage >= auditTotalPages}
                      onClick={() => setAuditPage(p => p + 1)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1 text-white"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CONFIRM DESTRUCTIVE ACTION */}
      {/* ==================================================================== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1D21] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">{confirmModal.title}</h3>
                <p className="text-xs text-white/50">Administrative confirmation required</p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed pt-1">
              {confirmModal.message}
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 py-2.5 rounded-xl text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm()}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-all shadow-lg ${
                  confirmModal.confirmVariant === 'danger'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
                }`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CREATE OUTLET */}
      {/* ==================================================================== */}
      {createStallModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1D21] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 space-y-4">
            <button
              onClick={() => setCreateStallModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-5 right-5 text-white/40 hover:text-white p-1 rounded-lg"
            >
              <X size={16} />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-[#930E36]/30 border border-[#930E36]/50 flex items-center justify-center text-[#FF004B]">
                <Store size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Create Campus Outlet</h3>
                <p className="text-xs text-white/50">Register a new food stall on platform</p>
              </div>
            </div>

            {createStallModal.error && (
              <div className="bg-red-950/40 border border-red-500/50 rounded-xl p-3 text-xs text-red-300">
                {createStallModal.error}
              </div>
            )}

            <form onSubmit={handleCreateStallSubmit} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">Outlet Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Campus Waffles & Shakes"
                  value={createStallModal.name}
                  onChange={e => setCreateStallModal(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">Campus Complex / Area *</label>
                <select
                  value={createStallModal.areaId}
                  onChange={e => setCreateStallModal(prev => ({ ...prev, areaId: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                  required
                >
                  <option value="">Select Area...</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">Assigned Owner User *</label>
                <select
                  value={createStallModal.ownerId}
                  onChange={e => setCreateStallModal(prev => ({ ...prev, ownerId: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                  required
                >
                  <option value="">Select User...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.email} - {u.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateStallModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 py-2.5 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStallModal.isSubmitting}
                  className="flex-1 bg-gradient-to-r from-red-600 to-[#FF004B] hover:from-red-500 hover:to-[#FF2666] text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-red-900/30"
                >
                  {createStallModal.isSubmitting ? 'Creating...' : 'Create Outlet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: EDIT OUTLET */}
      {/* ==================================================================== */}
      {editStallModal.isOpen && editStallModal.stall && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1D21] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 space-y-4">
            <button
              onClick={() => setEditStallModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-5 right-5 text-white/40 hover:text-white p-1 rounded-lg"
            >
              <X size={16} />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-[#930E36]/30 border border-[#930E36]/50 flex items-center justify-center text-[#FF004B]">
                <Edit3 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Edit Outlet Settings</h3>
                <p className="text-xs text-white/50">{editStallModal.stall.name} (#{editStallModal.stall.id})</p>
              </div>
            </div>

            {editStallModal.error && (
              <div className="bg-red-950/40 border border-red-500/50 rounded-xl p-3 text-xs text-red-300">
                {editStallModal.error}
              </div>
            )}

            <form onSubmit={handleEditStallSubmit} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">Outlet Name</label>
                <input
                  type="text"
                  value={editStallModal.name}
                  onChange={e => setEditStallModal(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">Campus Area</label>
                <select
                  value={editStallModal.areaId}
                  onChange={e => setEditStallModal(prev => ({ ...prev, areaId: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                >
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">Operating Status</label>
                <select
                  value={editStallModal.status}
                  onChange={e => setEditStallModal(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                >
                  <option value="ACTIVE">ACTIVE (Open for Orders)</option>
                  <option value="INACTIVE">INACTIVE (Closed)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <div className="text-xs font-semibold text-white">Closing Clearance Sale</div>
                  <div className="text-[10px] text-white/40">Apply dynamic surplus discount before stall closes</div>
                </div>
                <input
                  type="checkbox"
                  checked={editStallModal.isClosingSoon}
                  onChange={e => setEditStallModal(prev => ({ ...prev, isClosingSoon: e.target.checked }))}
                  className="w-4 h-4 accent-[#FF004B]"
                />
              </div>

              {editStallModal.isClosingSoon && (
                <div>
                  <label className="text-xs font-semibold text-white/70 block mb-1">Clearance Discount Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editStallModal.closingDiscount}
                    onChange={e => setEditStallModal(prev => ({ ...prev, closingDiscount: Number(e.target.value) }))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditStallModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 py-2.5 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editStallModal.isSubmitting}
                  className="flex-1 bg-gradient-to-r from-red-600 to-[#FF004B] hover:from-red-500 hover:to-[#FF2666] text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-red-900/30"
                >
                  {editStallModal.isSubmitting ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: VIEW STALL STAFF */}
      {/* ==================================================================== */}
      {stallStaffModal.isOpen && stallStaffModal.stall && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1D21] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 space-y-4">
            <button
              onClick={() => setStallStaffModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-5 right-5 text-white/40 hover:text-white p-1 rounded-lg"
            >
              <X size={16} />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Assigned Outlet Staff</h3>
                <p className="text-xs text-white/50">{stallStaffModal.stall.name}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 max-h-72 overflow-y-auto">
              {stallStaffModal.loading ? (
                <div className="py-8 text-center text-white/40">
                  <RefreshCw size={20} className="animate-spin mx-auto text-[#FF004B] mb-2" />
                  <span>Loading staff records...</span>
                </div>
              ) : stallStaffModal.staff.length === 0 ? (
                <div className="py-8 text-center text-white/40 text-xs">
                  No staff members currently assigned to this outlet.
                </div>
              ) : (
                stallStaffModal.staff.map((st: any) => (
                  <div key={st.id} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">{st.fullName}</div>
                      <div className="text-[10px] text-white/50">{st.email} • {st.phone || 'No phone'}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      st.isActive ? 'bg-emerald-950/60 text-emerald-300' : 'bg-red-950/60 text-red-300'
                    }`}>
                      {st.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setStallStaffModal(prev => ({ ...prev, isOpen: false }))}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl text-xs transition-all mt-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: VIEW STALL MENU */}
      {/* ==================================================================== */}
      {stallMenuModal.isOpen && stallMenuModal.stall && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1D21] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 space-y-4">
            <button
              onClick={() => setStallMenuModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-5 right-5 text-white/40 hover:text-white p-1 rounded-lg"
            >
              <X size={16} />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-[#930E36]/30 border border-[#930E36]/50 flex items-center justify-center text-[#FF004B]">
                <Coffee size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Outlet Food Menu</h3>
                <p className="text-xs text-white/50">{stallMenuModal.stall.name} ({stallMenuModal.items.length} items)</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 max-h-80 overflow-y-auto">
              {stallMenuModal.loading ? (
                <div className="py-8 text-center text-white/40">
                  <RefreshCw size={20} className="animate-spin mx-auto text-[#FF004B] mb-2" />
                  <span>Loading menu items...</span>
                </div>
              ) : stallMenuModal.items.length === 0 ? (
                <div className="py-8 text-center text-white/40 text-xs">
                  No food items registered for this outlet.
                </div>
              ) : (
                stallMenuModal.items.map((it: any) => (
                  <div key={it.id} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">{it.name}</div>
                      <div className="text-[10px] text-white/40">{it.category?.name || 'General'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400">₹{it.price}</div>
                      <span className={`text-[9px] font-bold ${it.isAvailable ? 'text-emerald-400' : 'text-red-400'}`}>
                        {it.isAvailable ? 'In Stock' : 'Sold Out'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setStallMenuModal(prev => ({ ...prev, isOpen: false }))}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl text-xs transition-all mt-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: EDIT USER ROLE */}
      {/* ==================================================================== */}
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
                <div className="grid grid-cols-4 gap-2">
                  {['CUSTOMER', 'STAFF', 'OWNER', 'ADMIN'].map(r => (
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

              {editRoleModal.user.role === 'ADMIN' && editRoleModal.role !== 'ADMIN' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                  Note: The platform prevents demoting the last active administrator to avoid platform lockout.
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
