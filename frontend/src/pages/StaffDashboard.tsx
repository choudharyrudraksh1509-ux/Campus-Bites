import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Utensils, 
  RefreshCw, 
  Check, 
  Store, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  User, 
  Phone, 
  Lock, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  History, 
  DollarSign, 
  CheckSquare, 
  Square, 
  SlidersHorizontal, 
  ChevronDown,
  X 
} from 'lucide-react';
import api from '../services/api';

const DEFAULT_CATEGORIES = [
  'Rolls',
  'Maggi & Noodles',
  'Beverages',
  'Snacks & Starters',
  'Burgers & Fries',
  'Meals & Thalis',
  'Pizzas',
  'Sandwiches',
  'South Indian',
  'Chaat & Street Food',
  'Desserts',
  'Biryani & Rice',
  'Curries & Breads',
  'Specialties'
];

interface FoodItem {
  id: number;
  item_id?: number;
  shop_id?: number;
  name: string;
  item_name?: string;
  description?: string;
  price: number;
  isAvailable: boolean;
  quantityAvailable?: number | null;
  category_id?: number;
  category_name?: string;
}

interface OrderItem {
  id: number;
  quantity: number;
  item: {
    id: number;
    name: string;
    price: number;
  };
}

interface Order {
  id: number;
  shopId: number;
  totalAmount: number;
  status: string;
  orderTime: string;
  pickup_token?: string;
  customer_name?: string;
  customer_phone?: string;
  customer?: {
    id: number;
    fullName: string;
    phone?: string;
    email?: string;
  };
  items: OrderItem[];
}

interface StallInfo {
  id: number;
  name: string;
  status: string;
  area: string;
  areaDescription?: string;
}

interface StaffInfo {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

export default function StaffDashboard() {
  const [activeTab, setActiveTab] = useState<'orders' | 'history' | 'menu' | 'profile'>('orders');
  
  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [stallInfo, setStallInfo] = useState<StallInfo | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffInfo | null>(null);

  // Loading & refresh states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'PLACED' | 'PREPARING' | 'READY'>('ALL');
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // One-Step Verification Modal State
  const [verifyModal, setVerifyModal] = useState<{
    isOpen: boolean;
    order: Order | null;
    targetStatus: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    order: null,
    targetStatus: '',
    isSubmitting: false
  });

  // Computed available categories list
  const availableCategories = useMemo(() => {
    const catSet = new Set<string>();
    categories.forEach(c => { if (c.name?.trim()) catSet.add(c.name.trim()); });
    menu.forEach(m => { if (m.category_name?.trim()) catSet.add(m.category_name.trim()); });
    DEFAULT_CATEGORIES.forEach(c => catSet.add(c));
    return Array.from(catSet).sort();
  }, [categories, menu]);

  // Menu Modal State (Add/Edit)
  const [menuModal, setMenuModal] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    item: FoodItem | null;
    name: string;
    price: string;
    description: string;
    categoryName: string;
    isCustomCategory: boolean;
    quantityAvailable: string;
    isAvailable: boolean;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    mode: 'add',
    item: null,
    name: '',
    price: '',
    description: '',
    categoryName: '',
    isCustomCategory: false,
    quantityAvailable: '',
    isAvailable: true,
    isSubmitting: false
  });

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    item: FoodItem | null;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    item: null,
    isSubmitting: false
  });

  // Stall & Profile Form State
  const [stallForm, setStallForm] = useState({
    name: '',
    status: 'ACTIVE',
    isSubmitting: false,
    message: ''
  });

  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    isSubmitting: false,
    message: '',
    error: ''
  });

  // Feedback Notification Toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const navigate = useNavigate();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userStr = localStorage.getItem('campusbite_user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Auth Guard
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'STAFF' && currentUser.role !== 'OWNER')) {
      navigate('/');
    } else {
      fetchOrders(true);
      fetchMenu();
      fetchStallDetails();
    }
  }, []);

  // Polling for Active Orders
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders(false);
      pollTimerRef.current = setInterval(() => {
        fetchOrders(false);
      }, 4000);
    } else if (activeTab === 'history') {
      fetchOrderHistory();
    } else if (activeTab === 'menu') {
      fetchMenu();
    } else if (activeTab === 'profile') {
      fetchStallDetails();
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [activeTab]);

  // Fetch functions
  const fetchOrders = async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const res = await api.get('/staff/orders');
      setOrders(res.data || []);
    } catch (err) {
      console.error('Failed to fetch active orders:', err);
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  };

  const fetchOrderHistory = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.get('/staff/orders/history');
      setHistoryOrders(res.data || []);
    } catch (err) {
      console.error('Failed to fetch order history:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchMenu = async () => {
    try {
      const [menuRes, catRes] = await Promise.all([
        api.get('/staff/menu'),
        api.get('/staff/categories')
      ]);
      setMenu(menuRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    }
  };

  const fetchStallDetails = async () => {
    try {
      const res = await api.get('/staff/stall');
      if (res.data?.stall) {
        setStallInfo(res.data.stall);
        setStallForm(prev => ({
          ...prev,
          name: res.data.stall.name,
          status: res.data.stall.status || 'ACTIVE'
        }));
      }
      if (res.data?.staff) {
        setStaffProfile(res.data.staff);
        setProfileForm(prev => ({
          ...prev,
          fullName: res.data.staff.name || '',
          phone: res.data.staff.phone || ''
        }));
      }
    } catch (err) {
      console.error('Failed to fetch stall info:', err);
    }
  };

  // ==========================================
  // ONE-STEP STATUS VERIFICATION HANDLERS
  // ==========================================
  const initiateStatusTransition = (order: Order, targetStatus: string) => {
    setVerifyModal({
      isOpen: true,
      order,
      targetStatus,
      isSubmitting: false
    });
  };

  const executeStatusUpdate = async () => {
    if (!verifyModal.order || !verifyModal.targetStatus) return;

    setVerifyModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await api.put(`/staff/orders/${verifyModal.order.id}/status`, {
        status: verifyModal.targetStatus
      });
      
      showToast(`Order #${verifyModal.order.id} status updated to ${verifyModal.targetStatus}!`, 'success');
      setVerifyModal({ isOpen: false, order: null, targetStatus: '', isSubmitting: false });
      fetchOrders(true);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      const msg = err.response?.data?.error || 'Failed to update order status';
      showToast(msg, 'error');
      setVerifyModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // ==========================================
  // MENU MANAGEMENT HANDLERS
  // ==========================================
  const handleToggleStock = async (item: FoodItem) => {
    const itemId = item.id || item.item_id;
    if (!itemId) return;
    try {
      await api.put(`/staff/menu/${itemId}`, {
        isAvailable: !item.isAvailable
      });
      showToast(`Stock updated for ${item.name || item.item_name}`);
      fetchMenu();
    } catch (err) {
      console.error(err);
      showToast('Failed to toggle stock status', 'error');
    }
  };

  const openAddMenuModal = () => {
    setMenuModal({
      isOpen: true,
      mode: 'add',
      item: null,
      name: '',
      price: '',
      description: '',
      categoryName: availableCategories[0] || 'Specialties',
      isCustomCategory: false,
      quantityAvailable: '',
      isAvailable: true,
      isSubmitting: false
    });
  };

  const openEditMenuModal = (item: FoodItem) => {
    const itemCat = item.category_name || (categories.find(c => c.id === item.category_id)?.name) || 'Specialties';
    const isKnown = availableCategories.includes(itemCat);
    const qtyStr = item.quantityAvailable !== undefined && item.quantityAvailable !== null
      ? String(item.quantityAvailable)
      : '';

    setMenuModal({
      isOpen: true,
      mode: 'edit',
      item,
      name: item.name || item.item_name || '',
      price: String(item.price || ''),
      description: item.description || '',
      categoryName: itemCat,
      isCustomCategory: !isKnown,
      quantityAvailable: qtyStr,
      isAvailable: item.isAvailable !== false,
      isSubmitting: false
    });
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuModal.name.trim() || !menuModal.price) {
      showToast('Name and price are required', 'error');
      return;
    }

    if (!menuModal.categoryName.trim()) {
      showToast('Please select or specify a category', 'error');
      return;
    }

    const trimmedQty = menuModal.quantityAvailable.trim();
    let qtyNum: number | null = null;
    if (trimmedQty !== '') {
      const parsed = parseInt(trimmedQty, 10);
      if (isNaN(parsed) || parsed < 0) {
        showToast('Quantity available must be a valid non-negative number', 'error');
        return;
      }
      qtyNum = parsed;
    }

    setMenuModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      const payload: any = {
        name: menuModal.name.trim(),
        price: Number(menuModal.price),
        description: menuModal.description.trim(),
        categoryName: menuModal.categoryName.trim(),
        isAvailable: menuModal.isAvailable,
        quantityAvailable: qtyNum
      };

      if (menuModal.mode === 'add') {
        await api.post('/staff/menu', payload);
        showToast('Menu item added successfully!');
      } else if (menuModal.mode === 'edit' && menuModal.item) {
        const itemId = menuModal.item.id || menuModal.item.item_id;
        await api.put(`/staff/menu/${itemId}`, payload);
        showToast('Menu item updated successfully!');
      }

      setMenuModal(prev => ({ ...prev, isOpen: false, isSubmitting: false }));
      fetchMenu();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to save menu item';
      showToast(msg, 'error');
      setMenuModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleDeleteMenuItem = async () => {
    if (!deleteModal.item) return;
    const itemId = deleteModal.item.id || deleteModal.item.item_id;
    setDeleteModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      const res = await api.delete(`/staff/menu/${itemId}`);
      showToast(res.data?.message || 'Menu item removed successfully');
      setDeleteModal({ isOpen: false, item: null, isSubmitting: false });
      fetchMenu();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to delete menu item';
      showToast(msg, 'error');
      setDeleteModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // ==========================================
  // STALL & PROFILE HANDLERS
  // ==========================================
  const handleUpdateStall = async (e: React.FormEvent) => {
    e.preventDefault();
    setStallForm(prev => ({ ...prev, isSubmitting: true, message: '' }));
    try {
      const res = await api.put('/staff/stall', {
        name: stallForm.name,
        status: stallForm.status
      });
      setStallInfo(res.data.stall);
      setStallForm(prev => ({ ...prev, isSubmitting: false, message: 'Stall settings updated successfully!' }));
      showToast('Stall settings saved!');
      // Update local storage stall name if changed
      if (currentUser && res.data.stall?.name) {
        currentUser.shopName = res.data.stall.name;
        localStorage.setItem('campusbite_user', JSON.stringify(currentUser));
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to update stall';
      showToast(msg, 'error');
      setStallForm(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileForm(prev => ({ ...prev, isSubmitting: true, message: '', error: '' }));

    if (profileForm.phone && profileForm.phone.trim()) {
      const cleanPhone = profileForm.phone.trim().replace(/[\s\-\(\)]/g, '');
      const indianRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
      const generalRegex = /^\+?[1-9]\d{9,14}$/;
      if (!indianRegex.test(cleanPhone) && !generalRegex.test(cleanPhone)) {
        setProfileForm(prev => ({ ...prev, isSubmitting: false, error: 'Please enter a valid 10-digit phone number (e.g. 9876543210)' }));
        return;
      }
    }

    if (profileForm.newPassword || profileForm.currentPassword || profileForm.confirmPassword) {
      if (!profileForm.currentPassword) {
        setProfileForm(prev => ({ ...prev, isSubmitting: false, error: 'Current password is required to change password' }));
        return;
      }
      if (!profileForm.newPassword) {
        setProfileForm(prev => ({ ...prev, isSubmitting: false, error: 'Please enter a new password' }));
        return;
      }
      if (profileForm.newPassword.length < 6) {
        setProfileForm(prev => ({ ...prev, isSubmitting: false, error: 'Password must be at least 6 characters' }));
        return;
      }
      if (!profileForm.confirmPassword) {
        setProfileForm(prev => ({ ...prev, isSubmitting: false, error: 'Please confirm your new password' }));
        return;
      }
      if (profileForm.newPassword !== profileForm.confirmPassword) {
        setProfileForm(prev => ({ ...prev, isSubmitting: false, error: 'New password and confirm new password do not match' }));
        return;
      }
    }

    try {
      const cleanPhone = profileForm.phone && profileForm.phone.trim() ? profileForm.phone.trim().replace(/[\s\-\(\)]/g, '') : null;
      const payload: any = {
        fullName: profileForm.fullName,
        phone: cleanPhone
      };
      if (profileForm.newPassword) {
        payload.currentPassword = profileForm.currentPassword;
        payload.password = profileForm.newPassword;
        payload.confirmPassword = profileForm.confirmPassword;
      }

      const res = await api.put('/auth/profile', payload);
      setProfileForm(prev => ({
        ...prev,
        isSubmitting: false,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        message: 'Profile updated successfully!',
        error: ''
      }));
      showToast('Profile updated successfully!');
      
      if (currentUser) {
        currentUser.name = res.data.user.name;
        currentUser.phone = res.data.user.phone;
        localStorage.setItem('campusbite_user', JSON.stringify(currentUser));
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to update profile';
      setProfileForm(prev => ({ ...prev, isSubmitting: false, error: msg }));
    }
  };

  // Badges & styling helpers
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAYMENT_PENDING': 
        return <span className="bg-amber-950/40 text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-amber-800/50">Payment Pending</span>;
      case 'PLACED': 
        return <span className="bg-blue-900/40 text-blue-400 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-blue-800/50">Order Placed</span>;
      case 'PREPARING': 
        return <span className="bg-yellow-900/40 text-yellow-400 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-yellow-800/50 animate-pulse">In Kitchen</span>;
      case 'READY': 
        return <span className="bg-green-900/40 text-green-400 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-green-800/50">Ready for Pickup</span>;
      case 'COMPLETED':
        return <span className="bg-emerald-950/40 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-emerald-800/50">Completed</span>;
      case 'CANCELLED':
        return <span className="bg-red-950/40 text-red-400 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-red-800/50">Cancelled</span>;
      default: 
        return <span className="bg-gray-800 text-gray-300 px-2.5 py-1 rounded-full text-[10px] font-medium">{status}</span>;
    }
  };

  // Filtered orders
  const filteredActiveOrders = orders.filter(order => {
    if (orderFilter === 'ALL') return true;
    return order.status === orderFilter;
  });

  const filteredHistoryOrders = historyOrders.filter(order => {
    const matchesFilter = historyFilter === 'ALL' || order.status === historyFilter;
    const query = historySearch.toLowerCase().trim();
    const matchesSearch = !query || 
      String(order.id).includes(query) ||
      (order.pickup_token && order.pickup_token.toLowerCase().includes(query)) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(query)) ||
      (order.customer?.fullName && order.customer.fullName.toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  });

  const filteredMenuItems = menu.filter(item => {
    const itemName = (item.name || item.item_name || '').toLowerCase();
    const query = menuSearch.toLowerCase().trim();
    const matchesSearch = !query || itemName.includes(query);
    const matchesCat = selectedCategory === 'ALL' || item.category_name === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // KPI calculations for History
  const totalCompletedOrders = historyOrders.filter(o => o.status === 'COMPLETED').length;
  const totalCancelledOrders = historyOrders.filter(o => o.status === 'CANCELLED').length;
  const totalRevenue = historyOrders
    .filter(o => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  return (
    <div className="flex flex-col md:flex-row min-h-[88vh] gap-6 fade-in pb-[calc(max(env(safe-area-inset-bottom,0px),8px)+4.5rem)] md:pb-12 text-white">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-2xl border text-sm backdrop-blur-md transition-all animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60' 
            : 'bg-red-950/90 text-red-300 border-red-700/60'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* SIDEBAR NAVIGATION */}
      {/* ========================================================= */}
      <div className="w-full md:w-64 space-y-4 shrink-0">
        
        {/* Stall Info Box */}
        <div className="bg-[#1D1D21] border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#930E36]/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#930E36]/30 border border-[#930E36]/50 text-[#FF004B] text-[11px] font-semibold">
              <Store size={12} />
              <span>{stallInfo?.name || currentUser?.shopName || 'Staff Portal'}</span>
            </div>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${stallInfo?.status === 'ACTIVE' || stallInfo?.status === 'OPEN' ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : 'bg-amber-500'}`} title={stallInfo?.status || 'Active'} />
          </div>

          <div className="font-bold text-white text-base tracking-tight">{staffProfile?.name || currentUser?.name || 'Staff User'}</div>
          <div className="text-[11px] text-white/50 font-mono mt-0.5 truncate">{staffProfile?.email || currentUser?.email}</div>
          
          {stallInfo?.area && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center text-[11px] text-white/40">
              <Clock size={11} className="mr-1.5 text-white/30" />
              <span>{stallInfo.area}</span>
            </div>
          )}
        </div>
        
        {/* Nav Tabs */}
        <div className="space-y-1.5 bg-[#1D1D21] border border-white/5 rounded-2xl p-2 shadow-2xl">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-semibold transition-all ${
              activeTab === 'orders' 
                ? 'bg-[#930E36]/25 text-[#FF004B] border border-[#930E36]/40 shadow-inner' 
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              <LayoutDashboard size={16} />
              <span>Active Orders</span>
            </div>
            {orders.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#FF004B] text-white">
                {orders.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-semibold transition-all ${
              activeTab === 'history' 
                ? 'bg-[#930E36]/25 text-[#FF004B] border border-[#930E36]/40 shadow-inner' 
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <History size={16} />
            <span>Past Orders</span>
          </button>

          <button 
            onClick={() => setActiveTab('menu')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-semibold transition-all ${
              activeTab === 'menu' 
                ? 'bg-[#930E36]/25 text-[#FF004B] border border-[#930E36]/40 shadow-inner' 
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Utensils size={16} />
            <span>Manage Menu</span>
          </button>

          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-semibold transition-all ${
              activeTab === 'profile' 
                ? 'bg-[#930E36]/25 text-[#FF004B] border border-[#930E36]/40 shadow-inner' 
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <SlidersHorizontal size={16} />
            <span>Stall & Profile</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================================= */}
      <div className="flex-1 bg-[#1D1D21] border border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col min-w-0">
        
        {/* Header Bar */}
        <div className="border-b border-white/5 p-4 sm:p-5 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold tracking-wider uppercase text-white">
              {activeTab === 'orders' && 'Live Kitchen Orders'}
              {activeTab === 'history' && 'Past Completed Orders'}
              {activeTab === 'menu' && 'Stall Menu Items'}
              {activeTab === 'profile' && 'Stall & Staff Settings'}
            </h2>
            <span className="text-xs text-white/30">•</span>
            <span className="text-xs text-[#FF004B] font-semibold">
              {stallInfo?.name || currentUser?.shopName || 'Your Stall'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {activeTab === 'orders' && (
              <span className="inline-flex items-center text-[10px] text-white/40 font-mono bg-white/5 px-2.5 py-1 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                Live Sync Active
              </span>
            )}
            <button 
              onClick={() => {
                if (activeTab === 'orders') fetchOrders(true);
                else if (activeTab === 'history') fetchOrderHistory();
                else if (activeTab === 'menu') fetchMenu();
                else fetchStallDetails();
              }} 
              disabled={isRefreshing}
              className="text-white/60 hover:text-white transition-colors flex items-center space-x-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg shadow-sm"
              title="Refresh Feed"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-[#FF004B]' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">

          {/* ===================================================== */}
          {/* TAB 1: LIVE ORDERS */}
          {/* ===================================================== */}
          {activeTab === 'orders' && (
            <div className="space-y-5">
              
              {/* Order Status Filter Chips */}
              <div className="flex flex-wrap gap-2 items-center">
                {(['ALL', 'PLACED', 'PREPARING', 'READY'] as const).map(tab => {
                  const count = tab === 'ALL' 
                    ? orders.length 
                    : orders.filter(o => o.status === tab).length;

                  return (
                    <button
                      key={tab}
                      onClick={() => setOrderFilter(tab)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center space-x-1.5 ${
                        orderFilter === tab 
                          ? 'bg-[#930E36] text-white shadow-lg shadow-[#930E36]/30 border border-[#FF004B]/30' 
                          : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      <span>{tab === 'ALL' ? 'All Orders' : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${orderFilter === tab ? 'bg-white/20' : 'bg-white/10'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Order Cards */}
              {filteredActiveOrders.length === 0 ? (
                <div className="text-center py-20 text-white/30 border border-white/5 border-dashed rounded-2xl bg-black/10">
                  <ShoppingBag size={40} className="mx-auto mb-3 opacity-40 text-[#FF004B]" />
                  <p className="text-sm font-medium text-white/60">No orders in queue</p>
                  <p className="text-xs text-white/30 mt-1">
                    {orderFilter === 'ALL' 
                      ? 'New incoming customer orders will appear here automatically.' 
                      : `No orders currently in ${orderFilter} state.`}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredActiveOrders.map(order => (
                    <div 
                      key={order.id} 
                      className="bg-black/30 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all flex flex-col justify-between shadow-xl relative overflow-hidden group"
                    >
                      {/* Top Token Banner */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center space-x-2.5">
                            <span className="font-mono font-bold text-xl text-white">#{order.id}</span>
                            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-[#930E36]/30 text-[#FF004B] border border-[#930E36]/50 font-bold tracking-wider">
                              {order.pickup_token || `TK-${1000 + (order.id % 9000)}`}
                            </span>
                            {getStatusBadge(order.status)}
                          </div>
                          
                          <p className="text-xs text-white/60 mt-2 flex items-center">
                            <span className="font-semibold text-white/90">
                              {order.customer_name || order.customer?.fullName || 'Campus Customer'}
                            </span>
                            {order.customer_phone && (
                              <span className="ml-2 text-white/40 font-mono">({order.customer_phone})</span>
                            )}
                            <span className="mx-2 text-white/20">•</span>
                            <span className="text-white/40">
                              {new Date(order.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-mono font-extrabold text-lg text-emerald-400">₹{order.totalAmount}</p>
                          <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Total</span>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="bg-white/[0.03] rounded-xl p-3.5 mb-4 text-xs border border-white/5 space-y-2">
                        {order.items?.map(oi => (
                          <div key={oi.id} className="flex justify-between items-center text-white/80">
                            <div className="flex items-center space-x-2">
                              <span className="w-5 h-5 rounded bg-white/10 text-white font-bold flex items-center justify-center text-[10px]">
                                {oi.quantity}x
                              </span>
                              <span className="font-medium text-white/90">{oi.item.name}</span>
                            </div>
                            <span className="font-mono text-white/60 text-[11px]">₹{oi.item.price * oi.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons with 2-Step Verification Trigger */}
                      <div className="flex gap-2 pt-2 border-t border-white/5">
                        
                        {/* Status Actions */}
                        {order.status === 'PAYMENT_PENDING' && (
                          <button 
                            onClick={() => initiateStatusTransition(order, 'PLACED')} 
                            className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] uppercase tracking-wider font-bold py-2.5 rounded-xl transition-all flex items-center justify-center space-x-1.5"
                          >
                            <span>Accept Order</span>
                            <ArrowRight size={13} />
                          </button>
                        )}

                        {order.status === 'PLACED' && (
                          <button 
                            onClick={() => initiateStatusTransition(order, 'PREPARING')} 
                            className="flex-1 bg-yellow-600/25 hover:bg-yellow-600/35 text-yellow-300 border border-yellow-500/30 text-[11px] uppercase tracking-wider font-bold py-2.5 rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-yellow-950/20"
                          >
                            <span>Start Preparing</span>
                            <ArrowRight size={13} />
                          </button>
                        )}

                        {order.status === 'PREPARING' && (
                          <button 
                            onClick={() => initiateStatusTransition(order, 'READY')} 
                            className="flex-1 bg-green-600/25 hover:bg-green-600/35 text-green-300 border border-green-500/30 text-[11px] uppercase tracking-wider font-bold py-2.5 rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-green-950/20"
                          >
                            <span>Mark Ready for Pickup</span>
                            <ArrowRight size={13} />
                          </button>
                        )}

                        {order.status === 'READY' && (
                          <button 
                            onClick={() => initiateStatusTransition(order, 'COMPLETED')} 
                            className="flex-1 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-[11px] uppercase tracking-wider font-bold py-2.5 rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-950/30"
                          >
                            <CheckCircle2 size={13} />
                            <span>Handed Over</span>
                          </button>
                        )}

                        {/* Order Cancellation Action */}
                        <button 
                          onClick={() => initiateStatusTransition(order, 'CANCELLED')} 
                          className="px-3.5 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-800/30 text-[11px] uppercase tracking-wider font-semibold py-2.5 rounded-xl transition-all"
                          title="Cancel Order"
                        >
                          Cancel
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================================================== */}
          {/* TAB 2: PAST COMPLETED ORDERS */}
          {/* ===================================================== */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              
              {/* History Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/50 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-white">{totalCompletedOrders}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Completed Orders</div>
                  </div>
                </div>

                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-[#930E36]/30 border border-[#930E36]/50 flex items-center justify-center text-[#FF004B]">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-emerald-400">₹{totalRevenue}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Fulfilled Revenue</div>
                  </div>
                </div>

                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-red-950/50 border border-red-800/40 flex items-center justify-center text-red-400">
                    <XCircle size={24} />
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-white">{totalCancelledOrders}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wider">Cancelled Orders</div>
                  </div>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search by Order #, token, customer name..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
                  />
                </div>

                <div className="flex gap-2">
                  {(['ALL', 'COMPLETED', 'CANCELLED'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setHistoryFilter(f)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                        historyFilter === f 
                          ? 'bg-[#930E36] text-white border border-[#FF004B]/30' 
                          : 'bg-white/5 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {f === 'ALL' ? 'All History' : f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* History Table */}
              {filteredHistoryOrders.length === 0 ? (
                <div className="text-center py-20 text-white/30 border border-white/5 border-dashed rounded-2xl bg-black/10">
                  <History size={40} className="mx-auto mb-3 opacity-40 text-white/30" />
                  <p className="text-sm font-medium text-white/60">No past orders found</p>
                  <p className="text-xs text-white/30 mt-1">Completed or cancelled orders will be archived here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30 shadow-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/5 text-white/50 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-5 py-3.5 font-semibold">Order</th>
                        <th className="px-5 py-3.5 font-semibold">Customer</th>
                        <th className="px-5 py-3.5 font-semibold">Items</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Amount</th>
                        <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredHistoryOrders.map(order => (
                        <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-mono font-bold text-white text-sm">#{order.id}</div>
                            <span className="font-mono text-[10px] text-[#FF004B] font-semibold">
                              {order.pickup_token || `TK-${1000 + (order.id % 9000)}`}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-semibold text-white/90">
                              {order.customer_name || order.customer?.fullName || 'Campus Customer'}
                            </div>
                            <div className="text-[11px] text-white/40">{order.customer?.email || 'Student'}</div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-0.5 max-w-xs">
                              {order.items?.map(oi => (
                                <div key={oi.id} className="text-white/70 truncate">
                                  <span className="font-bold text-white/90 mr-1">{oi.quantity}x</span> {oi.item.name}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-bold text-emerald-400 text-sm">
                            ₹{order.totalAmount}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {getStatusBadge(order.status)}
                          </td>
                          <td className="px-5 py-4 text-right text-white/40 font-mono">
                            <div>{new Date(order.orderTime).toLocaleDateString()}</div>
                            <div className="text-[10px]">
                              {new Date(order.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* ===================================================== */}
          {/* TAB 3: MANAGE MENU */}
          {/* ===================================================== */}
          {activeTab === 'menu' && (
            <div className="space-y-5">
              
              {/* Menu Controls Bar */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
                <div className="flex flex-1 gap-2 max-w-lg">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      placeholder="Search menu items..."
                      value={menuSearch}
                      onChange={e => setMenuSearch(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
                    />
                  </div>

                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[#FF004B]"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={openAddMenuModal}
                  className="bg-[#930E36] hover:bg-[#B31242] text-white px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-[#930E36]/30"
                >
                  <Plus size={14} />
                  <span>Add New Item</span>
                </button>
              </div>

              {/* Menu Items Table */}
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30 shadow-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/5 text-white/50 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Item Details</th>
                      <th className="px-5 py-4 font-semibold">Category</th>
                      <th className="px-5 py-4 font-semibold text-right">Price</th>
                      <th className="px-5 py-4 font-semibold text-center">Stock Status</th>
                      <th className="px-5 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredMenuItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-white/30">
                          No menu items found. Click "+ Add New Item" to populate your stall menu.
                        </td>
                      </tr>
                    ) : (
                      filteredMenuItems.map(item => {
                        const itemId = item.id || item.item_id || 0;
                        const isAvail = item.isAvailable !== false;

                        return (
                          <tr key={itemId} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-white text-sm">{item.name || item.item_name}</div>
                              {item.description && (
                                <div className="text-[11px] text-white/40 line-clamp-1 max-w-xs mt-0.5">
                                  {item.description}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[11px] font-medium">
                                {item.category_name || 'General'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-white text-sm">
                              ₹{item.price}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {isAvail ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center text-emerald-400 bg-emerald-950/40 border border-emerald-700/50 px-2.5 py-1 rounded-full text-[10px] font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
                                    Available
                                  </span>
                                  {item.quantityAvailable !== undefined && item.quantityAvailable !== null ? (
                                    <span className="text-[10px] font-mono text-amber-300 font-medium">
                                      {item.quantityAvailable} left
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-white/30 font-medium">
                                      Unlimited
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center text-red-400 bg-red-950/40 border border-red-700/50 px-2.5 py-1 rounded-full text-[10px] font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5" />
                                  Out of Stock
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button 
                                  onClick={() => handleToggleStock(item)}
                                  className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all ${
                                    isAvail 
                                      ? 'bg-amber-950/30 text-amber-300 border-amber-800/40 hover:bg-amber-950/50' 
                                      : 'bg-emerald-950/30 text-emerald-300 border-emerald-800/40 hover:bg-emerald-950/50'
                                  }`}
                                  title="Quick toggle stock status"
                                >
                                  {isAvail ? 'Mark Out' : 'Mark In'}
                                </button>
                                
                                <button
                                  onClick={() => openEditMenuModal(item)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all"
                                  title="Edit item details"
                                >
                                  <Edit2 size={13} />
                                </button>

                                <button
                                  onClick={() => setDeleteModal({ isOpen: true, item, isSubmitting: false })}
                                  className="p-1.5 rounded-lg bg-red-950/20 hover:bg-red-900/30 border border-red-800/30 text-red-400 hover:text-red-300 transition-all"
                                  title="Delete item"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ===================================================== */}
          {/* TAB 4: STALL & PROFILE DETAILS */}
          {/* ===================================================== */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Stall Settings Card */}
              <div className="bg-black/30 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center space-x-3 pb-4 border-b border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-[#930E36]/30 border border-[#930E36]/50 flex items-center justify-center text-[#FF004B]">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Stall Configuration</h3>
                    <p className="text-xs text-white/50">Manage stall name and operational availability</p>
                  </div>
                </div>

                {stallForm.message && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2">
                    <CheckCircle2 size={14} />
                    <span>{stallForm.message}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateStall} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                      Stall Name
                    </label>
                    <input
                      type="text"
                      required
                      value={stallForm.name}
                      onChange={e => setStallForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                      Campus Area / Location
                    </label>
                    <input
                      type="text"
                      disabled
                      value={stallInfo?.area || 'Campus Food Court'}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white/40 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                      Operational Status
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setStallForm(prev => ({ ...prev, status: 'ACTIVE' }))}
                        className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                          stallForm.status === 'ACTIVE' || stallForm.status === 'OPEN'
                            ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-400 shadow-lg'
                            : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Open (Accepting Orders)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStallForm(prev => ({ ...prev, status: 'PAUSED' }))}
                        className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                          stallForm.status === 'PAUSED' || stallForm.status === 'CLOSED'
                            ? 'bg-amber-950/40 border-amber-600/60 text-amber-400 shadow-lg'
                            : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Paused (Temporarily Closed)</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={stallForm.isSubmitting}
                    className="w-full bg-[#930E36] hover:bg-[#B31242] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#930E36]/30"
                  >
                    {stallForm.isSubmitting ? 'Saving Changes...' : 'Save Stall Settings'}
                  </button>
                </form>
              </div>

              {/* Staff Profile Card */}
              <div className="bg-black/30 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center space-x-3 pb-4 border-b border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-blue-950/50 border border-blue-800/40 flex items-center justify-center text-blue-400">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Staff Member Profile</h3>
                    <p className="text-xs text-white/50">Update personal contact info & login password</p>
                  </div>
                </div>

                {profileForm.message && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2">
                    <CheckCircle2 size={14} />
                    <span>{profileForm.message}</span>
                  </div>
                )}

                {profileForm.error && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center space-x-2">
                    <AlertCircle size={14} />
                    <span>{profileForm.error}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                      Staff Member Name
                    </label>
                    <input
                      type="text"
                      required
                      value={profileForm.fullName}
                      onChange={e => setProfileForm(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                      Login Email / Staff ID
                    </label>
                    <input
                      type="text"
                      disabled
                      value={staffProfile?.email || currentUser?.email || ''}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white/40 cursor-not-allowed font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={profileForm.phone}
                      onChange={e => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                    />
                  </div>

                  {/* Password Change Sub-section */}
                  <div className="pt-3 border-t border-white/5 space-y-3">
                    <div className="text-xs font-bold text-white/60 uppercase tracking-wider flex items-center">
                      <Lock size={12} className="mr-1.5" />
                      <span>Change Password (Optional)</span>
                    </div>

                    <div className="space-y-2.5">
                      <input
                        type="password"
                        placeholder="Current Password (required to change)"
                        value={profileForm.currentPassword}
                        onChange={e => setProfileForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
                      />
                      <input
                        type="password"
                        placeholder="New Password (min 6 characters)"
                        value={profileForm.newPassword}
                        onChange={e => setProfileForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
                      />
                      <input
                        type="password"
                        placeholder="Confirm New Password"
                        value={profileForm.confirmPassword}
                        onChange={e => setProfileForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={profileForm.isSubmitting}
                    className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all border border-white/10"
                  >
                    {profileForm.isSubmitting ? 'Updating Profile...' : 'Update Staff Profile'}
                  </button>
                </form>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ========================================================= */}
      {/* ONE-STEP VERIFICATION MODAL */}
      {/* ========================================================= */}
      {verifyModal.isOpen && verifyModal.order && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1D21] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 space-y-5">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#930E36]/30 text-[#FF004B] border border-[#930E36]/50">
                    Verify Status Update
                  </span>
                  <h3 className="font-bold text-white text-base">
                    Order #{verifyModal.order.id}
                  </h3>
                </div>
                <p className="text-xs text-white/50 mt-1">
                  Transition: <span className="font-mono text-white/80">{verifyModal.order.status}</span> → <span className="font-mono text-[#FF004B] font-bold">{verifyModal.targetStatus}</span>
                </p>
              </div>

              <button 
                onClick={() => setVerifyModal(prev => ({ ...prev, isOpen: false }))}
                className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Order Details & Token */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-mono text-[11px] text-white/40 uppercase tracking-wider">Pickup Token</span>
                  <div className="font-mono font-bold text-xl text-[#FF004B]">
                    {verifyModal.order.pickup_token || `TK-${1000 + (verifyModal.order.id % 9000)}`}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[11px] text-white/40 uppercase tracking-wider">Total Amount</span>
                  <div className="font-mono font-bold text-xl text-emerald-400">
                    ₹{verifyModal.order.totalAmount}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs text-white/70">
                <div>Customer: <span className="text-white font-semibold">{verifyModal.order.customer_name || verifyModal.order.customer?.fullName || 'Campus Student'}</span></div>
                {verifyModal.order.customer_phone && <div className="text-white/40 font-mono">{verifyModal.order.customer_phone}</div>}
              </div>
            </div>

            {/* Items Summary */}
            <div>
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                Order Items ({verifyModal.order.items?.length || 0})
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl divide-y divide-white/5 max-h-36 overflow-y-auto">
                {verifyModal.order.items?.map(oi => (
                  <div key={oi.id} className="p-2.5 px-3 flex items-center justify-between text-xs">
                    <span className="text-white font-medium">
                      <span className="font-bold text-[#FF004B] mr-2">{oi.quantity}x</span>
                      {oi.item.name}
                    </span>
                    <span className="font-mono text-white/50 text-[11px]">₹{oi.item.price * oi.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification Note Banner */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/80 flex items-center space-x-2.5">
              <CheckCircle2 size={16} className="text-[#FF004B] shrink-0" />
              <span>
                {verifyModal.targetStatus === 'PREPARING' && 'Confirm kitchen cooking initiated.'}
                {verifyModal.targetStatus === 'READY' && `Confirm order packed and placed at pickup counter for token ${verifyModal.order.pickup_token}.`}
                {verifyModal.targetStatus === 'COMPLETED' && `Confirm customer presented matching token ${verifyModal.order.pickup_token} and food handed over.`}
                {verifyModal.targetStatus === 'CANCELLED' && 'Confirm cancellation of this order for your stall.'}
                {verifyModal.targetStatus === 'PLACED' && 'Confirm order accepted into stall queue.'}
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVerifyModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 font-semibold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={verifyModal.isSubmitting}
                onClick={executeStatusUpdate}
                className="flex-1 bg-[#930E36] hover:bg-[#B31242] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-lg shadow-[#930E36]/30 transition-all"
              >
                {verifyModal.isSubmitting ? (
                  <span>Updating...</span>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm & Update Status</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MENU ITEM ADD / EDIT MODAL */}
      {/* ========================================================= */}
      {menuModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1D21] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <h3 className="font-bold text-white text-base">
                {menuModal.mode === 'add' ? 'Add New Stall Food Item' : 'Edit Food Item Details'}
              </h3>
              <button 
                onClick={() => setMenuModal(prev => ({ ...prev, isOpen: false }))}
                className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cheese Peri-Peri Maggie"
                  value={menuModal.name}
                  onChange={e => setMenuModal(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF004B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 80"
                    value={menuModal.price}
                    onChange={e => setMenuModal(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#FF004B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      value={menuModal.isCustomCategory ? '__CUSTOM__' : menuModal.categoryName}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__CUSTOM__') {
                          setMenuModal(prev => ({ ...prev, isCustomCategory: true, categoryName: '' }));
                        } else {
                          setMenuModal(prev => ({ ...prev, isCustomCategory: false, categoryName: val }));
                        }
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF004B] cursor-pointer appearance-none"
                    >
                      <option value="" disabled className="bg-[#1D1D21] text-white">-- Select Category --</option>
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat} className="bg-[#1D1D21] text-white">
                          {cat}
                        </option>
                      ))}
                      <option value="__CUSTOM__" className="bg-[#1D1D21] text-[#FF004B] font-semibold">
                        + Add Custom Category...
                      </option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                  </div>
                  {menuModal.isCustomCategory && (
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Type new category name..."
                      value={menuModal.categoryName}
                      onChange={e => setMenuModal(prev => ({ ...prev, categoryName: e.target.value }))}
                      className="w-full mt-2 bg-black/40 border border-[#FF004B]/50 rounded-xl px-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF004B]"
                    />
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Quantity Available (Optional)
                  </label>
                  <span className="text-[10px] text-white/40 font-mono">Optional</span>
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 20 (leave blank if unlimited)"
                  value={menuModal.quantityAvailable}
                  onChange={e => setMenuModal(prev => ({ ...prev, quantityAvailable: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Leave blank if this item is prepared on demand and has unlimited stock.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Freshly spiced 2-minute noodles with mozzarella topping..."
                  value={menuModal.description}
                  onChange={e => setMenuModal(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF004B]"
                />
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <input
                  type="checkbox"
                  id="modal-stock-check"
                  checked={menuModal.isAvailable}
                  onChange={e => setMenuModal(prev => ({ ...prev, isAvailable: e.target.checked }))}
                  className="accent-[#FF004B] rounded"
                />
                <label htmlFor="modal-stock-check" className="text-xs text-white cursor-pointer font-medium">
                  Currently in Stock & Available to Order
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMenuModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 font-semibold py-2.5 rounded-xl text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={menuModal.isSubmitting}
                  className="flex-1 bg-[#930E36] hover:bg-[#B31242] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-[#930E36]/30"
                >
                  {menuModal.isSubmitting ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {deleteModal.isOpen && deleteModal.item && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1D1D21] border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950/40 border border-red-800/40 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 size={24} />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-white text-base">Remove Menu Item?</h3>
              <p className="text-xs text-white/60 mt-1">
                Are you sure you want to remove <strong className="text-white">{deleteModal.item.name || deleteModal.item.item_name}</strong>?
              </p>
              <p className="text-[11px] text-white/40 mt-2 bg-white/5 p-2 rounded-xl">
                Note: If this item was previously ordered in past customer transactions, it will be safely disabled from the menu rather than deleted.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, item: null, isSubmitting: false })}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 font-semibold py-2.5 rounded-xl text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteModal.isSubmitting}
                onClick={handleDeleteMenuItem}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-red-950/40"
              >
                {deleteModal.isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
