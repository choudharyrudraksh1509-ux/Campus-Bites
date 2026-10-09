import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Utensils, RefreshCw, Check } from 'lucide-react';
import api from '../services/api';

export default function StaffDashboard() {
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const navigate = useNavigate();

  const userStr = localStorage.getItem('campusbite_user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    if (!user || (user.role !== 'STAFF' && user.role !== 'OWNER')) {
      navigate('/');
    } else {
      fetchOrders();
      fetchMenu();
    }
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/staff/orders');
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await api.get('/shops/1/menu'); // Defaulting to shop 1 for demo
      setMenu(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      await api.put(`/staff/orders/${orderId}/status`, { status });
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  const toggleAvailability = async (itemId: number, currentStatus: boolean) => {
    try {
      await api.put(`/owner/menu/${itemId}`, { isAvailable: !currentStatus });
      fetchMenu();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAYMENT_PENDING': return <span className="bg-gray-800 text-gray-300 px-2.5 py-1 rounded-full text-[10px] font-medium border border-gray-700">Payment Pending</span>;
      case 'PLACED': return <span className="bg-blue-900/30 text-blue-400 px-2.5 py-1 rounded-full text-[10px] font-medium border border-blue-800/50">Placed</span>;
      case 'PREPARING': return <span className="bg-yellow-900/30 text-yellow-400 px-2.5 py-1 rounded-full text-[10px] font-medium border border-yellow-800/50">Preparing</span>;
      case 'READY': return <span className="bg-green-900/30 text-green-400 px-2.5 py-1 rounded-full text-[10px] font-medium border border-green-800/50">Ready</span>;
      default: return <span className="bg-gray-800 text-gray-300 px-2.5 py-1 rounded-full text-[10px] font-medium">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[85vh] gap-6 fade-in pt-16">
      {/* Sidebar */}
      <div className="w-full md:w-64 space-y-4">
        <div className="bg-[#1D1D21] border border-white/5 rounded-2xl p-5 shadow-2xl">
          <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Staff Portal</div>
          <div className="font-medium text-white">{user?.name}</div>
        </div>
        
        <div className="space-y-1.5 bg-[#1D1D21] border border-white/5 rounded-2xl p-2 shadow-2xl">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-medium transition-all ${activeTab === 'orders' ? 'bg-[#930E36]/20 text-[#FF004B] border border-[#930E36]/30' : 'text-white/60 hover:bg-white/5'}`}
          >
            <LayoutDashboard size={16} />
            <span>Active Orders</span>
          </button>

          <button 
            onClick={() => setActiveTab('menu')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-medium transition-all ${activeTab === 'menu' ? 'bg-[#930E36]/20 text-[#FF004B] border border-[#930E36]/30' : 'text-white/60 hover:bg-white/5'}`}
          >
            <Utensils size={16} />
            <span>Manage Menu</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-[#1D1D21] border border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-white/5 p-5 flex justify-between items-center bg-white/[0.02]">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
            {activeTab === 'orders' ? 'Live Order Feed' : 'Menu Management'}
          </h2>
          <button onClick={activeTab === 'orders' ? fetchOrders : fetchMenu} className="text-white/50 hover:text-white transition-colors flex items-center space-x-1.5 text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg shadow-sm">
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1">
          {activeTab === 'orders' ? (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="text-center py-16 text-white/30 border border-white/5 border-dashed rounded-xl">
                  <ShoppingBag size={32} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No active orders right now.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {orders.map((order) => (
                    <div key={order.id} className="bg-black/20 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
                      <div className="flex justify-between items-start mb-5">
                        <div>
                          <div className="flex items-center space-x-3">
                            <span className="font-mono font-medium text-lg text-white">#{order.id}</span>
                            {getStatusBadge(order.status)}
                          </div>
                          <p className="text-xs text-white/50 mt-1.5 flex items-center">
                            <span className="font-medium text-white/80">{order.customer?.fullName}</span>
                            <span className="mx-2">•</span>
                            {new Date(order.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-medium text-white">₹{order.totalAmount}</p>
                        </div>
                      </div>
                      
                      <div className="bg-white/5 rounded-xl p-3.5 mb-5 text-sm border border-white/5 space-y-1.5">
                        {order.items?.map((oi: any) => (
                          <div key={oi.id} className="flex justify-between items-center">
                            <span className="text-white/70 text-xs"><span className="text-white font-medium mr-1.5">{oi.quantity}x</span> {oi.item.name}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        {order.status === 'PLACED' && (
                          <button onClick={() => updateOrderStatus(order.id, 'PREPARING')} className="flex-1 bg-yellow-600/20 text-yellow-400 border border-yellow-600/30 text-[11px] uppercase tracking-wider font-medium py-2.5 rounded-xl hover:bg-yellow-600/30 transition-colors">
                            Start Preparing
                          </button>
                        )}
                        {order.status === 'PREPARING' && (
                          <button onClick={() => updateOrderStatus(order.id, 'READY')} className="flex-1 bg-green-600/20 text-green-400 border border-green-600/30 text-[11px] uppercase tracking-wider font-medium py-2.5 rounded-xl hover:bg-green-600/30 transition-colors">
                            Mark Ready
                          </button>
                        )}
                        {order.status === 'READY' && (
                          <button onClick={() => updateOrderStatus(order.id, 'COMPLETED')} className="flex-1 bg-white/10 text-white/70 border border-white/10 text-[11px] uppercase tracking-wider font-medium py-2.5 rounded-xl hover:bg-white/20 transition-colors">
                            Handed Over
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white/5 border-b border-white/5 text-white/50 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-4 font-medium">Item Name</th>
                      <th className="px-5 py-4 font-medium">Category</th>
                      <th className="px-5 py-4 font-medium text-right">Price</th>
                      <th className="px-5 py-4 font-medium text-center">Status</th>
                      <th className="px-5 py-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {menu.map((item) => (
                      <tr key={item.item_id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-white/90 text-xs">{item.item_name}</td>
                        <td className="px-5 py-3.5 text-white/50 text-xs">{item.category_name}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-white/80 text-xs">₹{item.price}</td>
                        <td className="px-5 py-3.5 text-center">
                          {item.isAvailable !== false ? (
                            <span className="inline-flex items-center text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full text-[10px]">
                              Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full text-[10px]">
                              Out of Stock
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button 
                            onClick={() => toggleAvailability(item.item_id, item.isAvailable !== false)}
                            className="text-[10px] font-medium uppercase tracking-wider border border-white/10 px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            Toggle Stock
                          </button>
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
    </div>
  );
}
