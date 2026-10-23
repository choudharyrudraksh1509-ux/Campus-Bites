import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Store,
  RefreshCw,
  AlertCircle,
  XCircle,
  ChefHat,
  PackageCheck,
  CheckCheck,
  ArrowRight,
  Calendar,
  Repeat,
  Play,
  Pause,
  Trash2,
  Timer,
  CreditCard,
  Sparkles
} from 'lucide-react';
import orderService, { type Order } from '../services/orderService';
import autobookService, { type AutobookSchedule } from '../services/autobookService';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [autobookSchedules, setAutobookSchedules] = useState<AutobookSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'AUTOBOOK'>('ALL');
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [triggeringScheduleId, setTriggeringScheduleId] = useState<number | null>(null);

  const fetchOrdersAndSchedules = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      setError(null);
      const [ordersData, schedulesData] = await Promise.all([
        orderService.getOrders(),
        autobookService.getSchedules()
      ]);
      setOrders(ordersData);
      setAutobookSchedules(schedulesData);
    } catch (err: any) {
      console.error('Failed to load orders or schedules', err);
      if (!isSilent) {
        setError(err.response?.data?.error || err.message || 'Unable to load orders from server.');
      }
    } finally {
      setLoading(false);
      if (!isSilent) setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchOrdersAndSchedules(false);
  }, [fetchOrdersAndSchedules]);

  // Real-time automatic polling every 5 seconds to track kitchen progress live
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrdersAndSchedules(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchOrdersAndSchedules]);

  // Listen to autobook changes
  useEffect(() => {
    const handleAutobookSync = () => {
      autobookService.getSchedules().then(setAutobookSchedules);
    };
    window.addEventListener('autobookUpdated', handleAutobookSync);
    return () => window.removeEventListener('autobookUpdated', handleAutobookSync);
  }, []);

  const handleCancel = async (orderId: number) => {
    if (!window.confirm(`Are you sure you want to cancel order #ORD-${orderId}?`)) return;
    setCancellingOrderId(orderId);
    try {
      await orderService.cancelOrder(orderId);
      setOrders(prev =>
        prev.map(o => (o.order_id === orderId ? { ...o, status: 'CANCELLED' } : o))
      );
      alert(`Order #ORD-${orderId} has been successfully cancelled.`);
    } catch (error: any) {
      alert(`Unable to cancel order: ${error.message || 'Please contact counter staff.'}`);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleConfirmPayment = async (orderId: number) => {
    try {
      await orderService.confirmPayment(orderId);
      fetchOrdersAndSchedules(false);
      alert(`Payment confirmed for Order #ORD-${orderId}! Kitchen will begin preparation.`);
    } catch (err: any) {
      alert(`Payment confirmation failed: ${err.message}`);
    }
  };

  const handleToggleSchedule = async (id: number) => {
    try {
      await autobookService.toggleSchedule(id);
      const updated = await autobookService.getSchedules();
      setAutobookSchedules(updated);
    } catch (err) {
      console.error('Failed to toggle schedule', err);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!window.confirm('Delete this daily recurring order schedule?')) return;
    try {
      await autobookService.deleteSchedule(id);
      const updated = await autobookService.getSchedules();
      setAutobookSchedules(updated);
    } catch (err) {
      console.error('Failed to delete schedule', err);
    }
  };

  const handleTriggerScheduleNow = async (schedule: AutobookSchedule) => {
    setTriggeringScheduleId(schedule.id);
    try {
      const placed = await autobookService.triggerScheduleNow(schedule);
      alert(`⚡ Daily Autobook Order Placed Now!\nItem: ${schedule.quantity}x ${schedule.itemName}\nToken: ${placed.pickup_token}\nEstimated Pickup in ${placed.estimated_delivery_minutes || 15} mins`);
      await fetchOrdersAndSchedules(false);
      setActiveFilter('ACTIVE');
    } catch (err: any) {
      alert(`Failed to trigger order: ${err.message || 'Please try again.'}`);
    } finally {
      setTriggeringScheduleId(null);
    }
  };

  const isOrderActive = (status: string) =>
    ['PAYMENT_PENDING', 'PLACED', 'PREPARING', 'READY'].includes(status);

  const filteredOrders = orders.filter(order => {
    if (activeFilter === 'ACTIVE') return isOrderActive(order.status);
    if (activeFilter === 'COMPLETED')
      return ['COMPLETED', 'CANCELLED'].includes(order.status);
    return true;
  });

  const getStatusProgress = (status: string) => {
    switch (status) {
      case 'PAYMENT_PENDING':
        return { step: 1, width: '15%', label: 'Payment Pending' };
      case 'PLACED':
        return { step: 1, width: '25%', label: 'Order Placed' };
      case 'PREPARING':
        return { step: 2, width: '60%', label: 'In the Kitchen' };
      case 'READY':
        return { step: 3, width: '90%', label: 'Ready for Pickup' };
      case 'COMPLETED':
        return { step: 4, width: '100%', label: 'Handover Completed' };
      case 'CANCELLED':
        return { step: 0, width: '0%', label: 'Cancelled' };
      default:
        return { step: 1, width: '25%', label: status };
    }
  };

  const getDeliveryTimeInfo = (order: Order) => {
    if (order.is_preorder && order.pickup_time) {
      return {
        isPreorder: true,
        primaryText: `Pre-order for ${order.pickup_time}`,
        secondaryText: `Cooking scheduled before ${order.pickup_time}`,
        prepTime: order.prep_time_minutes || 10,
        queueNo: order.queue_number || 1
      };
    }

    const estMin = order.estimated_delivery_minutes || order.estimatedMinutes || 15;
    const baseDate = order.order_time ? new Date(order.order_time) : new Date();
    const readyDate = new Date(baseDate.getTime() + estMin * 60 * 1000);

    const now = new Date();
    const diffMs = readyDate.getTime() - now.getTime();
    const remainingMin = Math.max(0, Math.ceil(diffMs / (60 * 1000)));

    return {
      isPreorder: false,
      primaryText: `Ready at ${readyDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      secondaryText: remainingMin > 0 ? `(~${remainingMin} mins remaining)` : 'Ready right now at counter!',
      prepTime: order.prep_time_minutes || 10,
      queueNo: order.queue_number || 1
    };
  };

  const formatScheduleTimeDisplay = (time24: string) => {
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr || '8', 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  return (
    <div className="space-y-6 fade-in pb-[calc(max(env(safe-area-inset-bottom,0px),8px)+4.5rem)] md:pb-12 max-w-4xl mx-auto px-1 sm:px-0">
      
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#4C1829] text-white rounded-3xl p-6 sm:p-7 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_10px_30px_rgba(76,24,41,0.6)] border border-[#930E36] relative overflow-hidden">
        <div className="relative z-10">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-xs text-white/80 hover:text-white mb-2.5 transition-colors uppercase tracking-wider"
          >
            <span>← Back to Campus Outlets</span>
          </button>

          <h1 className="text-2xl sm:text-3xl text-white tracking-tight flex items-center space-x-3">
            <ShoppingBag className="text-white" size={30} />
            <span>My Takeaway Orders</span>
          </h1>
          <div className="flex items-center space-x-2 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <p className="text-xs text-white/80 font-medium">
              Live queue & preparation tracking active • Preorders & daily autobooks supported
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 relative z-10 self-start sm:self-auto">
          <button
            onClick={() => fetchOrdersAndSchedules(false)}
            disabled={isRefreshing}
            className="flex items-center space-x-2 bg-white text-[#4C1829] font-medium hover:bg-white/90 text-xs px-4 py-2.5 rounded-2xl transition-all shrink-0 shadow-lg"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Updating...' : 'Refresh Activity'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs (including Feature 1 Daily Autobooks) */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex space-x-2">
          {(['ALL', 'ACTIVE', 'COMPLETED', 'AUTOBOOK'] as const).map(tab => {
            const count =
              tab === 'ALL'
                ? orders.length
                : tab === 'ACTIVE'
                ? orders.filter(o => isOrderActive(o.status)).length
                : tab === 'COMPLETED'
                ? orders.filter(o => ['COMPLETED', 'CANCELLED'].includes(o.status)).length
                : autobookSchedules.length;

            const label =
              tab === 'ALL'
                ? 'All Orders'
                : tab === 'ACTIVE'
                ? 'Active Orders'
                : tab === 'COMPLETED'
                ? 'Past Orders'
                : '📅 Daily Autobooks';

            return (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-4 py-2 rounded-2xl text-xs uppercase tracking-wider font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  activeFilter === tab
                    ? 'bg-[#4C1829] text-white border border-[#930E36] shadow-lg font-bold'
                    : 'bg-[#1D1D21]/80 text-white/70 hover:text-white border border-[#930E36]/30'
                }`}
              >
                {tab === 'AUTOBOOK' && <Repeat size={13} className="text-pink-300" />}
                <span>{label}</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-white/20">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* View Switch: Regular Orders vs Daily Autobooks */}
      {activeFilter === 'AUTOBOOK' ? (
        /* FEATURE 1: Daily Autobooks Tab View */
        <div className="space-y-4">
          <div className="bg-[#4C1829]/60 border border-[#930E36]/60 rounded-3xl p-5 text-xs text-white/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-pink-500/20 border border-pink-500/40 rounded-2xl text-pink-300">
                <Repeat size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Autobook Daily Schedules</h4>
                <p className="text-white/70 text-[11px]">
                  Recurring daily orders trigger automatically at your designated time without manual ordering.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/')}
              className="bg-white text-[#4C1829] font-bold text-xs px-4 py-2 rounded-xl hover:bg-white/90 transition-all uppercase tracking-wider self-start sm:self-auto shrink-0 shadow"
            >
              + Schedule New Item
            </button>
          </div>

          {autobookSchedules.length === 0 ? (
            <div className="bg-[#1D1D21]/90 border border-white/15 rounded-3xl p-10 text-center space-y-4 text-white">
              <Repeat size={44} className="mx-auto text-white/30" />
              <div>
                <h3 className="text-base text-white font-medium">No Daily Autobook Schedules</h3>
                <p className="text-xs text-white/70 mt-1 max-w-sm mx-auto">
                  Browse any outlet menu and click "Autobook" on your favorite tea, coffee, breakfast or meal to schedule automatic daily ordering!
                </p>
              </div>
              <button
                onClick={() => navigate('/')}
                className="bg-[#4C1829] hover:bg-[#5C1D33] text-white border border-[#930E36] text-xs px-6 py-3 rounded-2xl shadow-lg transition-all uppercase tracking-wider inline-flex items-center space-x-2"
              >
                <Store size={16} />
                <span>Explore Campus Outlets</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {autobookSchedules.map(schedule => (
                <div
                  key={schedule.id}
                  className="bg-[#4C1829] text-white border border-[#930E36] rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-[#930E36]/60 pb-3">
                    <div>
                      <span className="text-xs text-pink-300 font-semibold flex items-center space-x-1.5">
                        <Repeat size={13} />
                        <span>Daily at {formatScheduleTimeDisplay(schedule.scheduledTime)}</span>
                      </span>
                      <h4 className="text-base font-bold text-white mt-0.5">{schedule.itemName}</h4>
                      <p className="text-[11px] text-white/70 flex items-center space-x-1 mt-0.5">
                        <Store size={12} />
                        <span>{schedule.shopName}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-bold text-white font-mono">
                        ₹{schedule.price * schedule.quantity}
                      </span>
                      <span className="text-[10px] text-white/60 block">{schedule.quantity}x unit</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-white/70">
                      Status:{' '}
                      <strong className={schedule.isActive ? 'text-emerald-400' : 'text-amber-400'}>
                        {schedule.isActive ? 'Active (Auto-Orders Daily)' : 'Paused'}
                      </strong>
                    </span>

                    <button
                      onClick={() => handleToggleSchedule(schedule.id)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-medium border transition-all flex items-center space-x-1 ${
                        schedule.isActive
                          ? 'bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-900/60'
                          : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                      }`}
                    >
                      {schedule.isActive ? <Pause size={12} /> : <Play size={12} />}
                      <span>{schedule.isActive ? 'Pause' : 'Resume'}</span>
                    </button>
                  </div>

                  {schedule.notes && (
                    <div className="p-2 rounded-xl bg-black/25 text-[11px] text-white/70 italic border border-white/5">
                      "{schedule.notes}"
                    </div>
                  )}

                  {/* Actions: Trigger now & Delete */}
                  <div className="pt-2 border-t border-[#930E36]/50 flex items-center justify-between">
                    <button
                      onClick={() => handleTriggerScheduleNow(schedule)}
                      disabled={triggeringScheduleId === schedule.id}
                      className="bg-white hover:bg-white/90 text-[#4C1829] font-bold px-3.5 py-1.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <Sparkles size={13} className="text-[#4C1829]" />
                      <span>{triggeringScheduleId === schedule.id ? 'Ordering...' : 'Order Now'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="p-1.5 text-red-300 hover:text-white hover:bg-red-600 rounded-xl transition-colors"
                      title="Delete autobook schedule"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* REGULAR ORDERS LIST (ALL, ACTIVE, COMPLETED) */
        loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div
                key={i}
                className="h-48 bg-[#4C1829]/30 animate-pulse rounded-3xl border border-[#930E36]/30"
              ></div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-[#1D1D21]/90 border border-white/15 rounded-3xl p-10 text-center space-y-4 backdrop-blur-md shadow-xl text-white">
            <ShoppingBag size={48} className="mx-auto text-white/30" />
            <div>
              <h3 className="text-base text-white">
                {activeFilter === 'ACTIVE'
                  ? 'No Active Takeaway Orders'
                  : activeFilter === 'COMPLETED'
                  ? 'No Past Orders Found'
                  : 'No Orders Placed Yet'}
              </h3>
              <p className="text-xs text-white/70 mt-1 max-w-sm mx-auto">
                {activeFilter === 'ACTIVE'
                  ? 'All your orders have been completed or cancelled.'
                  : 'Visit any of our campus food outlets to order your favorite bites!'}
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-[#4C1829] hover:bg-[#5C1D33] text-white border border-[#930E36] text-xs px-6 py-3 rounded-2xl shadow-lg transition-all uppercase tracking-wider inline-flex items-center space-x-2"
            >
              <Store size={16} />
              <span>Explore Campus Outlets</span>
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredOrders.map(order => {
              const progress = getStatusProgress(order.status);
              const isCancelled = order.status === 'CANCELLED';
              const isPendingPayment = order.status === 'PAYMENT_PENDING';
              const canCancel = ['PLACED', 'PAYMENT_PENDING'].includes(order.status);
              const delInfo = getDeliveryTimeInfo(order);

              return (
                <div
                  key={order.order_id}
                  className="bg-[#4C1829] text-white border border-[#930E36] rounded-3xl p-5 sm:p-7 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_10px_30px_rgba(76,24,41,0.6)] space-y-5 relative overflow-hidden transition-all"
                >
                  <div className="relative z-10 space-y-5">
                    
                    {/* Card Top Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#930E36]/60 pb-4 gap-3">
                      <div>
                        <div className="flex items-center space-x-2.5">
                          <span className="font-mono text-xs font-semibold text-white/90 bg-[#930E36]/40 px-2 py-0.5 rounded-md border border-[#930E36]/60">
                            #ORD-{order.order_id}
                          </span>
                          <span className="text-xs text-white/70 flex items-center space-x-1">
                            <Clock size={12} />
                            <span>{order.created_at}</span>
                          </span>

                          {/* Pre-order or Regular tag */}
                          {order.is_preorder && (
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center space-x-1">
                              <Calendar size={11} />
                              <span>PRE-ORDER</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-xl text-white font-medium mt-1 flex items-center space-x-2">
                          <Store size={18} className="text-white/80" />
                          <span>{order.shop_name}</span>
                        </h3>
                      </div>

                      {/* Prominent Pickup Token Badge */}
                      <div className="flex items-center space-x-2 self-start sm:self-auto">
                        <div className="bg-white text-[#4C1829] font-bold px-4 py-2.5 rounded-2xl text-xs sm:text-sm tracking-wider shadow-lg flex items-center space-x-2 border border-transparent">
                          <Clock size={16} className="text-[#4C1829]" />
                          <span>Pickup Token: {order.pickup_token}</span>
                        </div>
                      </div>
                    </div>

                    {/* FEATURE 3: Live Food Preparation & Queue Time Estimation Box */}
                    {!isCancelled && (
                      <div className="bg-[#930E36]/40 border border-[#930E36]/60 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-white">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shrink-0">
                            <Timer size={20} />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-white">
                                {delInfo.primaryText}
                              </span>
                              {!delInfo.isPreorder && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold px-2 py-0.2 rounded-md font-mono">
                                  {delInfo.secondaryText}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-white/70 mt-0.5">
                              Stall Queue Position: <strong className="text-white">#{delInfo.queueNo}</strong> • Estimated Food Prep Time: <strong className="text-white">~{delInfo.prepTime} mins</strong>
                            </p>
                          </div>
                        </div>

                        {/* Payment Mode demo vs verified badge */}
                        <div className="flex items-center space-x-1.5 self-start sm:self-auto bg-black/25 px-2.5 py-1 rounded-xl border border-white/10 text-[11px] text-white/80 font-mono">
                          <CreditCard size={12} className="text-pink-300" />
                          {order.payment_method === 'ONLINE_DEMO' ? (
                            <span className="text-amber-300 font-semibold">DEMO SANDBOX (ONLINE_DEMO)</span>
                          ) : (
                            <span className="text-emerald-300 font-semibold">VERIFIED ({order.payment_method || 'ONLINE'})</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Status Progress Stepper */}
                    {!isCancelled ? (
                      <div className="bg-[#930E36]/30 backdrop-blur-md border border-[#930E36]/50 rounded-2xl p-3.5 sm:p-5 space-y-3">
                        <div className="flex justify-between items-center text-[10px] sm:text-xs uppercase tracking-tight sm:tracking-wider text-white gap-1 overflow-x-hidden">
                          <span
                            className={`flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                              order.status === 'PLACED'
                                ? 'text-white font-bold underline'
                                : progress.step > 1
                                ? 'text-white/90'
                                : 'text-white/60'
                            }`}
                          >
                            <CheckCircle2 size={12} className="shrink-0" />
                            <span>1. Placed</span>
                          </span>

                          <span
                            className={`flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                              order.status === 'PREPARING'
                                ? 'text-white font-bold underline'
                                : progress.step > 2
                                ? 'text-white/90'
                                : 'text-white/60'
                            }`}
                          >
                            <ChefHat size={12} className="shrink-0" />
                            <span>2. Preparing</span>
                          </span>

                          <span
                            className={`flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                              order.status === 'READY'
                                ? 'text-white font-bold underline'
                                : progress.step > 3
                                ? 'text-white/90'
                                : 'text-white/60'
                            }`}
                          >
                            <PackageCheck size={12} className="shrink-0" />
                            <span>3. Ready<span className="hidden sm:inline"> for Pickup</span></span>
                          </span>

                          <span
                            className={`flex items-center space-x-1 whitespace-nowrap shrink-0 ${
                              order.status === 'COMPLETED'
                                ? 'text-white font-bold underline'
                                : 'text-white/60'
                            }`}
                          >
                            <CheckCheck size={12} className="shrink-0" />
                            <span>4. Handover</span>
                          </span>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-white h-full transition-all duration-700 ease-out"
                            style={{ width: progress.width }}
                          ></div>
                        </div>

                        {/* State Hint */}
                        <div className="text-[11px] text-white/80 flex items-center justify-between pt-1">
                          <span>
                            {order.status === 'PLACED' && (order.is_preorder ? `Pre-order confirmed for ${order.pickup_time}` : 'Waiting for kitchen to start prep')}
                            {order.status === 'PREPARING' && 'Chef is currently cooking your items fresh'}
                            {order.status === 'READY' && 'Food is packed! Head to the stall counter'}
                            {order.status === 'COMPLETED' && 'Takeaway meal collected successfully'}
                            {order.status === 'PAYMENT_PENDING' && 'Awaiting payment confirmation'}
                          </span>
                          {order.status === 'READY' && (
                            <span className="bg-emerald-500 text-white font-semibold px-2 py-0.5 rounded-md text-[10px] animate-pulse">
                              Ready Now
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-950/60 border border-red-500/40 rounded-2xl p-4 flex items-center space-x-3 text-red-200">
                        <XCircle size={22} className="text-red-400 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-red-100">Order Cancelled</p>
                          <p className="text-[11px] text-red-300/80">
                            This takeaway order was cancelled. Any pre-authorized charges will be reversed.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Itemized Order Details */}
                    <div className="bg-black/25 rounded-2xl p-4 space-y-2.5 border border-[#930E36]/30">
                      <div className="text-[11px] uppercase tracking-wider text-white/80 font-medium border-b border-[#930E36]/40 pb-1.5 flex justify-between">
                        <span>Ordered Items</span>
                        <span>Amount</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-white/95">
                              <div className="flex items-center space-x-2">
                                <span className="bg-[#930E36]/60 text-white px-2 py-0.5 rounded-md font-mono text-[11px]">
                                  {item.quantity}x
                                </span>
                                <span>{item.name}</span>
                              </div>
                              <span className="font-mono text-white">
                                ₹{item.price * item.quantity}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-white/70 italic">Takeaway Meal Pack</p>
                        )}
                      </div>
                    </div>

                    {/* Order Footer & Actions */}
                    <div className="pt-2 border-t border-[#930E36]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-white">
                      <div className="flex items-center space-x-3">
                        {isPendingPayment && (
                          <button
                            onClick={() => handleConfirmPayment(order.order_id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-medium transition-all shadow-md"
                          >
                            Confirm Payment
                          </button>
                        )}

                        {canCancel && (
                          <button
                            onClick={() => handleCancel(order.order_id)}
                            disabled={cancellingOrderId === order.order_id}
                            className="text-[#ff5555] hover:text-[#ff2222] font-medium underline transition-colors disabled:opacity-50"
                          >
                            {cancellingOrderId === order.order_id
                              ? 'Cancelling...'
                              : 'Cancel Takeaway Order'}
                          </button>
                        )}

                        {!canCancel && !isCancelled && (
                          <span className="text-white/80 flex items-center space-x-1.5">
                            <CheckCircle2 size={14} className="text-emerald-400" />
                            <span>Takeaway Confirmed</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-right">
                        <span className="text-white/70 text-xs">Total Amount:</span>
                        <span className="text-white text-base font-semibold">
                          ₹{order.total_amount}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

    </div>
  );
}
