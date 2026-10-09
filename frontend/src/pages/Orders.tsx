import { useEffect, useState } from 'react';
import api from '../services/api';

interface Order {
  order_id: number;
  shop_name: string;
  status: string;
  total_amount: string;
  order_time: string;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders/my-orders')
      .then(res => setOrders(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center py-8">Loading your orders...</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">My Orders</h2>
      
      {orders.length === 0 ? (
        <p className="text-gray-500">You haven't placed any orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.order_id} className="p-6 bg-white border rounded-xl shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-center">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Order #{order.order_id}</h3>
                <p className="text-gray-600 font-medium">{order.shop_name}</p>
                <p className="text-sm text-gray-500 mt-1">Placed on: {new Date(order.order_time).toLocaleString()}</p>
              </div>
              <div className="mt-4 sm:mt-0 text-left sm:text-right">
                <p className="font-bold text-lg text-gray-900">₹{order.total_amount}</p>
                <span className={`inline-block mt-2 px-3 py-1 text-sm font-semibold rounded-full ${
                  order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {order.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
