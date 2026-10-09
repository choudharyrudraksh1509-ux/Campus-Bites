import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Clock, CheckCircle2, Store, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../services/api';

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  order_id: number;
  shop_name: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  pickup_token: string;
  created_at: string;
}

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = () => {
    setLoading(true);
    const savedLocal = JSON.parse(localStorage.getItem('campusbite_orders') || '[]');

    api.get('/orders')
      .then(res => {
        if (res.data && res.data.length > 0) {
          const mapped = res.data.map((o: any) => ({
            order_id: o.id || o.order_id,
            shop_name: o.shop?.name || o.shop_name || 'Campus Outlet',
            items: o.items ? o.items.map((i: any) => ({
              id: i.itemId || i.id,
              name: i.item?.name || i.name || 'Food Item',
              quantity: i.quantity,
              price: Number(i.priceAtOrder || i.price || 0)
            })) : [],
            total_amount: Number(o.totalAmount || o.total_amount || 0),
            status: o.status || 'PLACED',
            pickup_token: o.pickup_token || `TK-${1000 + (o.id % 9000)}`,
            created_at: o.orderTime ? new Date(o.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'
          }));
          setOrders(mapped);
        } else {
          setOrders(savedLocal);
        }
      })
      .catch(() => {
        setOrders(savedLocal);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCancel = async (orderId: number) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      await api.patch(`/orders/${orderId}/cancel`);
      alert('Order cancelled successfully.');
      fetchOrders();
    } catch (error: any) {
      alert(`Failed to cancel order: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div className="space-y-6 fade-in pt-20 pb-24 max-w-4xl mx-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#4C1829] text-white rounded-3xl p-6 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_10px_30px_rgba(76,24,41,0.6)] border border-[#930E36] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"></div>

        <div className="relative z-10">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-xs text-white/80 hover:text-white mb-2 transition-colors uppercase tracking-wider"
          >
            <span>Back to Campus Outlets</span>
          </button>

          <h1 className="text-2xl sm:text-3xl text-white tracking-tight flex items-center space-x-2">
            <ShoppingBag className="text-white" size={28} />
            <span>My Takeaway Orders</span>
          </h1>
          <p className="text-xs text-white/80 font-medium mt-1">
            Track live kitchen preparation & present secret pickup tokens at counter
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="flex items-center space-x-2 bg-white text-[#4C1829] font-medium hover:bg-white/90 text-xs px-4 py-2.5 rounded-2xl transition-colors shrink-0 shadow-lg relative z-10"
        >
          <RefreshCw size={14} />
          <span>Refresh Activity</span>
        </button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-44 bg-[#4C1829]/30 animate-pulse rounded-3xl border border-[#930E36]/30"></div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-[#1D1D21]/90 border border-white/15 rounded-3xl p-10 text-center space-y-4 backdrop-blur-md shadow-xl text-white">
          <ShoppingBag size={48} className="mx-auto text-white/40" />
          <div>
            <h3 className="text-base text-white">No Orders Placed Yet</h3>
            <p className="text-xs text-white/70 mt-1">Visit your favorite campus outlet and place a takeaway order!</p>
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
          {orders.map((order) => (
            <div
              key={order.order_id}
              className="bg-[#4C1829] text-white border border-[#930E36] rounded-3xl p-6 shadow-[0_30px_70px_rgba(0,0,0,0.85),0_10px_30px_rgba(76,24,41,0.6)] space-y-4 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"></div>

              <div className="relative z-10 space-y-4">
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#930E36]/60 pb-4 gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs text-white/80">#ORD-{order.order_id}</span>
                      <span className="text-xs text-white/70">• {order.created_at}</span>
                    </div>
                    <h3 className="text-lg text-white mt-0.5">{order.shop_name}</h3>
                  </div>

                  {/* Secret Pickup Token Badge */}
                  <div className="bg-white text-[#4C1829] font-medium px-4 py-2 rounded-2xl text-xs tracking-wider shadow-md flex items-center space-x-2 border border-white/40">
                    <Clock size={16} />
                    <span>Pickup Token: {order.pickup_token}</span>
                  </div>
                </div>

                {/* Status Stepper Progress */}
                <div className="bg-[#930E36]/30 backdrop-blur-md border border-[#930E36]/50 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs uppercase tracking-wider text-white">
                    <span className={order.status === 'PLACED' ? 'text-white underline' : 'text-white/60'}>
                      1. Order Placed
                    </span>
                    <span className={order.status === 'PREPARING' ? 'text-white underline' : 'text-white/60'}>
                      2. Kitchen Preparing
                    </span>
                    <span className={order.status === 'READY' ? 'text-white underline' : 'text-white/60'}>
                      3. Ready For Pickup
                    </span>
                    <span className={order.status === 'COMPLETED' ? 'text-white underline' : 'text-white/60'}>
                      4. Handover Done
                    </span>
                  </div>

                  <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-white h-full transition-all duration-500"
                      style={{
                        width:
                          order.status === 'PLACED' ? '25%' :
                          order.status === 'PREPARING' ? '60%' :
                          order.status === 'READY' ? '90%' : '100%'
                      }}
                    ></div>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="space-y-1.5 text-xs text-white/90">
                  {order.items && order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span><span className="bg-[#930E36]/40 px-2 py-0.5 rounded-md mr-1">{item.quantity}x</span> {item.name}</span>
                      <span className="font-mono text-white">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Order Footer */}
                <div className="pt-3 border-t border-[#930E36]/60 flex justify-between items-center text-xs text-white">
                  {(order.status === 'PLACED' || order.status === 'PAYMENT_PENDING') ? (
                    <button
                      onClick={() => handleCancel(order.order_id)}
                      className="text-[#ff4d4d] hover:text-[#ff1a1a] underline font-medium"
                    >
                      Cancel Order
                    </button>
                  ) : (
                    <span className="text-white/80">Takeaway Payment Complete</span>
                  )}
                  <span className="text-white text-sm">Total Paid: ₹{order.total_amount}</span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
