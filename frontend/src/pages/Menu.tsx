import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, ShoppingBag } from 'lucide-react';
import api from '../services/api';

interface MenuItem {
  item_id: number;
  shop_id: number;
  shop_name: string;
  item_name: string;
  category_name: string;
  price: number;
}

export default function Menu() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<{id: number, quantity: number, price: number, name: string}>[]>([]);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);

  useEffect(() => {
    api.get(`/shops/${shopId}/menu`)
      .then(res => setMenu(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [shopId]);

  const updateCart = (id: number, price: number, name: string, delta: number) => {
    setCart((prev) => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        const newQ = existing.quantity + delta;
        if (newQ <= 0) return prev.filter(item => item.id !== id);
        return prev.map(item => item.id === id ? { ...item, quantity: newQ } : item);
      }
      if (delta > 0) return [...prev, { id, quantity: 1, price, name }];
      return prev;
    });
  };

  const placeOrder = async () => {
    setPlacingOrder(true);
    try {
      const payload = {
        shopId: Number(shopId),
        items: cart.map(c => ({ itemId: c.id, quantity: c.quantity }))
      };
      const res = await api.post('/orders', payload);
      alert(`Order placed successfully! Order ID: ${res.data.orderId}`);
      navigate('/orders');
    } catch (err: any) {
      alert('Failed to place order: ' + (err.response?.data?.error || err.message));
    } finally {
      setPlacingOrder(false);
    }
  };

  const getQty = (id: number) => cart.find(c => c.id === id)?.quantity || 0;
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cart.reduce((acc, item) => acc + (item.quantity * item.price), 0);

  if (loading) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg border"></div>;

  const shopName = menu.length > 0 ? menu[0].shop_name : 'Shop Menu';

  return (
    <div className="flex flex-col lg:flex-row gap-8 fade-in">
      <div className="flex-1">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Spots</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{shopName}</h1>
          <p className="text-gray-500 text-sm mt-1">Select items to add to your order.</p>
        </div>

        <div className="space-y-4">
          {menu.map((item) => (
            <div key={item.item_id} className="p-5 border rounded-lg bg-white shadow-sm flex justify-between items-center hover:border-gray-300 transition-all">
              <div>
                <h3 className="font-semibold text-gray-900">{item.item_name}</h3>
                <p className="text-xs text-gray-500 mb-2">{item.category_name}</p>
                <p className="font-medium text-gray-900 font-mono">₹{item.price}</p>
              </div>
              
              <div className="flex items-center space-x-3 bg-gray-50 border rounded-md p-1">
                <button 
                  onClick={() => updateCart(item.item_id, Number(item.price), item.item_name, -1)}
                  className="p-1 text-gray-500 hover:text-black hover:bg-gray-200 rounded transition-colors"
                  disabled={getQty(item.item_id) === 0}
                >
                  <Minus size={16} />
                </button>
                <span className="w-4 text-center text-sm font-medium">{getQty(item.item_id)}</span>
                <button 
                  onClick={() => updateCart(item.item_id, Number(item.price), item.item_name, 1)}
                  className="p-1 text-gray-500 hover:text-black hover:bg-gray-200 rounded transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
          {menu.length === 0 && (
            <div className="text-center py-12 bg-white border border-dashed rounded-lg text-gray-500">
              This shop currently has no items available.
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Cart */}
      <div className="w-full lg:w-80">
        <div className="bg-white border rounded-lg shadow-sm sticky top-24 overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50 flex items-center space-x-2">
            <ShoppingBag size={18} className="text-gray-700" />
            <h3 className="font-semibold text-gray-900">Your Order</h3>
          </div>
          
          <div className="p-4 flex-1 min-h-[200px] max-h-[400px] overflow-y-auto">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <ShoppingBag size={32} className="mb-2 opacity-20" />
                <p className="text-sm">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(c => (
                  <div key={c.id} className="flex justify-between items-start text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{c.quantity}x</span> <span className="text-gray-700">{c.name}</span>
                    </div>
                    <span className="font-mono text-gray-900 ml-2">₹{c.price * c.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-gray-50">
            <div className="flex justify-between items-center mb-4 text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-mono font-medium text-gray-900">₹{totalPrice}</span>
            </div>
            <button 
              onClick={placeOrder}
              disabled={cart.length === 0 || placingOrder}
              className={`w-full py-2.5 rounded-md text-sm font-medium transition-all flex justify-center items-center ${
                cart.length === 0 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-black text-white hover:bg-gray-800 shadow-sm'
              }`}
            >
              {placingOrder ? 'Processing...' : `Checkout (₹${totalPrice})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
