import { useEffect, useState, useCallback } from 'react';
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
  ArrowRight
} from 'lucide-react';
import orderService, { type Order } from '../services/orderService';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const data = await orderService.getOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
      if (!isSilent) setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  // Real-time automatic polling every 5 seconds to track kitchen progress live
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleCancel = async (orderId: number) => {
    if (!window.confirm(`Are you sure you want to cancel order #ORD-${orderId}?`)) return;
    setCancellingOrderId(orderId);
    try {
      await orderService.cancelOrder(orderId);
      // Immediately reflect in state
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
      fetchOrders(false);
      alert(`Payment confirmed for Order #ORD-${orderId}! Kitchen will begin preparation.`);
    } catch (err: any) {
      alert(`Payment confirmation failed: ${err.message}`);
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

  return (
    <div className="space-y-6 fade-in pt-3 md:pt-20 pb-20 md:pb-28 max-w-4xl mx-auto px-1 sm:px-0">
      
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#4C1829] text-white rounded-3xl p-6 sm:p-7 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_10px_30px_rgba(76,24,41,0.6)] border border-[#930E36] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"></div>

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
              Live kitchen tracking active • Present pickup tokens at stall counter
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 relative z-10 self-start sm:self-auto">
          <button
            onClick={() => fetchOrders(false)}
            disabled={isRefreshing}
            className="flex items-center space-x-2 bg-white text-[#4C1829] font-medium hover:bg-white/90 text-xs px-4 py-2.5 rounded-2xl transition-all shrink-0 shadow-lg"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Updating...' : 'Refresh Activity'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex space-x-2">
          {(['ALL', 'ACTIVE', 'COMPLETED'] as const).map(tab => {
            const count =
              tab === 'ALL'
                ? orders.length
                : tab === 'ACTIVE'
                ? orders.filter(o => isOrderActive(o.status)).length
                : orders.filter(o => ['COMPLETED', 'CANCELLED'].includes(o.status)).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-4 py-2 rounded-2xl text-xs uppercase tracking-wider font-medium transition-all ${
                  activeFilter === tab
                    ? 'bg-[#4C1829] text-white border border-[#930E36] shadow-lg'
                    : 'bg-[#1D1D21]/80 text-white/70 hover:text-white border border-white/10'
                }`}
              >
                {tab === 'ALL' ? 'All Orders' : tab === 'ACTIVE' ? 'Active / Preparing' : 'Past / Completed'}
                <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-white/20">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
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
            const isCompleted = order.status === 'COMPLETED';
            const isPendingPayment = order.status === 'PAYMENT_PENDING';
            const canCancel = ['PLACED', 'PAYMENT_PENDING'].includes(order.status);

            return (
              <div
                key={order.order_id}
                className="bg-[#4C1829] text-white border border-[#930E36] rounded-3xl p-6 sm:p-7 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_10px_30px_rgba(76,24,41,0.6)] space-y-5 relative overflow-hidden transition-all"
              >
                <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"></div>

                <div className="relative z-10 space-y-5">
                  {/* Card Top Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#930E36]/60 pb-4 gap-3">
                    <div>
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono text-xs font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded-md">
                          #ORD-{order.order_id}
                        </span>
                        <span className="text-xs text-white/70 flex items-center space-x-1">
                          <Clock size={12} />
                          <span>{order.created_at}</span>
                        </span>
                      </div>
                      <h3 className="text-xl text-white font-medium mt-1 flex items-center space-x-2">
                        <Store size={18} className="text-white/80" />
                        <span>{order.shop_name}</span>
                      </h3>
                    </div>

                    {/* Prominent Pickup Token Badge */}
                    <div className="flex items-center space-x-2 self-start sm:self-auto">
                      <div className="bg-white text-[#4C1829] font-bold px-4 py-2.5 rounded-2xl text-xs sm:text-sm tracking-wider shadow-lg flex items-center space-x-2 border border-white/50">
                        <Clock size={16} className="text-[#4C1829]" />
                        <span>Pickup Token: {order.pickup_token}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Progress Stepper */}
                  {!isCancelled ? (
                    <div className="bg-[#930E36]/30 backdrop-blur-md border border-[#930E36]/50 rounded-2xl p-4 sm:p-5 space-y-3">
                      <div className="flex justify-between items-center text-[11px] sm:text-xs uppercase tracking-wider text-white">
                        <span
                          className={`flex items-center space-x-1 ${
                            order.status === 'PLACED'
                              ? 'text-white font-bold underline'
                              : progress.step > 1
                              ? 'text-white/90'
                              : 'text-white/60'
                          }`}
                        >
                          <CheckCircle2 size={13} />
                          <span>1. Placed</span>
                        </span>

                        <span
                          className={`flex items-center space-x-1 ${
                            order.status === 'PREPARING'
                              ? 'text-white font-bold underline'
                              : progress.step > 2
                              ? 'text-white/90'
                              : 'text-white/60'
                          }`}
                        >
                          <ChefHat size={13} />
                          <span>2. Preparing</span>
                        </span>

                        <span
                          className={`flex items-center space-x-1 ${
                            order.status === 'READY'
                              ? 'text-white font-bold underline'
                              : progress.step > 3
                              ? 'text-white/90'
                              : 'text-white/60'
                          }`}
                        >
                          <PackageCheck size={13} />
                          <span>3. Ready for Pickup</span>
                        </span>

                        <span
                          className={`flex items-center space-x-1 ${
                            order.status === 'COMPLETED'
                              ? 'text-white font-bold underline'
                              : 'text-white/60'
                          }`}
                        >
                          <CheckCheck size={13} />
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
                          {order.status === 'PLACED' && 'Waiting for kitchen to start prep'}
                          {order.status === 'PREPARING' && 'Chef is currently cooking your items'}
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
                  <div className="bg-black/20 rounded-2xl p-4 space-y-2.5 border border-white/5">
                    <div className="text-[11px] uppercase tracking-wider text-white/70 font-medium border-b border-white/10 pb-1.5 flex justify-between">
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
      )}

    </div>
  );
}
