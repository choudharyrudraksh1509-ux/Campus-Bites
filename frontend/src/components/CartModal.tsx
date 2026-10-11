import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  X,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';

export interface CartItem {
  id: number;
  shopId: number;
  shopName: string;
  quantity: number;
  price: number;
  name: string;
}

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCartChange?: () => void;
}

export default function CartModal({ isOpen, onClose, onCartChange }: CartModalProps) {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [viewStep, setViewStep] = useState<'cart' | 'checkout'>('cart');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'CASH'>('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sync cart from localStorage whenever modal opens or storage changes
  const loadCartFromStorage = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('campusbite_cart') || '[]');
      if (Array.isArray(saved)) {
        setCart(saved);
      } else {
        setCart([]);
      }
    } catch {
      setCart([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCartFromStorage();
      setViewStep('cart');
      setShowClearConfirm(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleCartSync = () => {
      loadCartFromStorage();
    };
    window.addEventListener('cartUpdated', handleCartSync);
    window.addEventListener('storage', handleCartSync);
    return () => {
      window.removeEventListener('cartUpdated', handleCartSync);
      window.removeEventListener('storage', handleCartSync);
    };
  }, []);

  const persistCart = (updatedCart: CartItem[]) => {
    setCart(updatedCart);
    if (updatedCart.length === 0) {
      localStorage.removeItem('campusbite_cart');
    } else {
      localStorage.setItem('campusbite_cart', JSON.stringify(updatedCart));
    }
    window.dispatchEvent(new Event('cartUpdated'));
    onCartChange?.();
  };

  const handleUpdateQty = (itemId: number, delta: number) => {
    const updated = cart
      .map(item => {
        if (item.id === itemId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      })
      .filter((item): item is CartItem => item !== null);

    persistCart(updated);
  };

  const handleDeleteItem = (itemId: number) => {
    const updated = cart.filter(item => item.id !== itemId);
    persistCart(updated);
  };

  const handleClearCart = () => {
    persistCart([]);
    setShowClearConfirm(false);
  };

  const totalItemsCount = cart.reduce((acc, c) => acc + c.quantity, 0);
  const cartSubtotal = cart.reduce((acc, c) => acc + c.quantity * c.price, 0);
  const packagingFee = cart.length > 0 ? 10 : 0;
  const grandTotal = cartSubtotal + packagingFee;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const shopId = cart[0]?.shopId || 1;
      const shopName = cart[0]?.shopName || 'Campus Outlet';

      let orderId = Math.floor(1000 + Math.random() * 9000);

      if (token) {
        try {
          const res = await api.post('/orders', {
            shopId: shopId,
            items: cart.map(c => ({
              itemId: c.id,
              quantity: c.quantity,
              name: c.name,
              price: c.price
            }))
          });
          if (res.data?.orderId) {
            orderId = res.data.orderId;
            // Confirm payment for takeaway order
            await api.post(`/orders/${orderId}/payment`);
          }
        } catch (err: any) {
          console.warn('Backend order placement failed:', err.response?.data?.error || err.message);
          alert(`Failed to place order: ${err.response?.data?.error || err.message}`);
          setIsSubmitting(false);
          return;
        }
      }

      const generatedToken = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
      const newOrder = {
        order_id: orderId,
        shop_name: shopName,
        items: cart,
        total_amount: grandTotal,
        status: 'PLACED',
        pickup_token: generatedToken,
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const savedOrders = JSON.parse(localStorage.getItem('campusbite_orders') || '[]');
      localStorage.setItem('campusbite_orders', JSON.stringify([newOrder, ...savedOrders]));

      // Clear Cart
      persistCart([]);
      onClose();

      alert(`Takeaway Order Placed Successfully!\nToken: ${generatedToken}\nPayment Method: ${paymentMethod}\nPickup at ${shopName} in 10-15 mins.`);
      navigate('/orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#4C1829] sm:bg-black/80 sm:backdrop-blur-md sm:flex sm:items-center sm:justify-center p-0 sm:p-4 animate-fade-in">
      <div
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)'
        }}
        className="bg-[#4C1829] text-white w-full h-full sm:h-auto sm:max-h-[88vh] sm:max-w-lg sm:rounded-3xl p-4 sm:p-7 shadow-none sm:shadow-[0_30px_70px_rgba(0,0,0,0.95)] border-0 sm:border border-[#930E36] relative overflow-hidden flex flex-col"
      >
        <div className="relative z-10 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#930E36]/60 pb-3 mb-3 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-[#930E36]/40 rounded-2xl border border-[#930E36]/60">
                <ShoppingBag size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white tracking-tight">
                  {viewStep === 'cart' ? 'Your Takeaway Cart' : 'Checkout & Payment'}
                </h3>
                {cart.length > 0 && (
                  <p className="text-xs text-white/80">
                    Outlet: <strong className="text-white">{cart[0]?.shopName}</strong> ({totalItemsCount} items)
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {cart.length > 0 && viewStep === 'cart' && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="px-2.5 py-1 text-[11px] bg-red-900/40 hover:bg-red-700/60 text-red-200 border border-red-500/30 rounded-xl transition-all flex items-center space-x-1"
                  title="Clear entire cart"
                >
                  <Trash2 size={13} className="text-red-300" />
                  <span>Clear Cart</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                aria-label="Close cart modal"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Clear Cart Confirmation Dialog */}
          {showClearConfirm && (
            <div className="bg-red-950/80 border border-red-500/50 p-3.5 rounded-2xl mb-4 flex items-center justify-between space-x-3 shrink-0 animate-fade-in">
              <div className="flex items-center space-x-2 text-xs text-red-200">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <span>Are you sure you want to remove all items from your cart?</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearCart}
                  className="px-2.5 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Yes, Clear
                </button>
              </div>
            </div>
          )}

          {/* Modal Body */}
          {cart.length === 0 ? (
            /* Empty Cart State - Centered cleanly on screen without awkward empty space */
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-white/70 space-y-4 my-auto">
              <div className="w-20 h-20 bg-[#930E36]/30 border border-[#930E36]/50 rounded-3xl flex items-center justify-center mx-auto text-white shadow-inner">
                <ShoppingBag size={36} className="opacity-80" />
              </div>
              <div className="space-y-1.5 max-w-xs mx-auto">
                <h4 className="text-lg font-medium text-white">Your takeaway cart is empty</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Browse campus outlets and add delicious food items to place your takeaway order.
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  navigate('/');
                }}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-white text-[#4C1829] font-medium text-xs rounded-xl hover:bg-white/90 active:scale-95 transition-all uppercase tracking-wider shadow-lg"
              >
                <span>Browse Campus Outlets</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : viewStep === 'cart' ? (
            /* Cart Items View */
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Outlet Notice */}
              <div className="text-[11px] bg-[#930E36]/30 text-white/90 p-2.5 rounded-xl border border-[#930E36]/50 flex items-center space-x-2 mb-3 shrink-0">
                <Clock size={14} className="text-white shrink-0" />
                <span>
                  Counter takeaway from <strong>{cart[0]?.shopName}</strong> • Fast pickup ready in 10-15m
                </span>
              </div>

              {/* Scrollable Items List */}
              <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-0">
                {cart.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#930E36]/25 border border-[#930E36]/40 text-xs transition-all hover:border-[#930E36]/70"
                  >
                    {/* Item Details */}
                    <div className="space-y-0.5 max-w-[50%]">
                      <div className="font-medium text-white truncate text-sm">{item.name}</div>
                      <div className="text-[11px] text-white/70">
                        ₹{item.price} each • <span className="text-white font-medium">₹{item.price * item.quantity}</span>
                      </div>
                    </div>

                    {/* Quantity Modifier and Delete Button */}
                    <div className="flex items-center space-x-2.5 shrink-0">
                      {/* Plus / Minus Control */}
                      <div className="flex items-center space-x-1.5 bg-[#4C1829] px-1.5 py-1 rounded-xl border border-[#930E36]/60">
                        <button
                          onClick={() => handleUpdateQty(item.id, -1)}
                          className="w-6 h-6 bg-white text-[#4C1829] rounded-lg flex items-center justify-center hover:bg-white/90 active:scale-95 transition-all shadow-sm"
                          title="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center text-xs font-semibold text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQty(item.id, 1)}
                          className="w-6 h-6 bg-white text-[#4C1829] rounded-lg flex items-center justify-center hover:bg-white/90 active:scale-95 transition-all shadow-sm"
                          title="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {/* Individual Delete / Trash button */}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-900/30 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 hover:border-red-600 transition-all active:scale-90"
                        title="Delete item from cart"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bill Details Calculation */}
              <div className="pt-3 mt-3 border-t border-[#930E36]/60 space-y-1.5 text-xs text-white shrink-0">
                <div className="flex justify-between text-white/80">
                  <span>Items Subtotal</span>
                  <span className="text-white font-medium">₹{cartSubtotal}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Packaging Fee</span>
                  <span className="text-white font-medium">₹{packagingFee}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#930E36]/60 text-sm font-medium text-white">
                  <span>Grand Total</span>
                  <span className="text-lg text-white font-bold">₹{grandTotal}</span>
                </div>
              </div>

              {/* Checkout Action Button */}
              <div className="pt-3 shrink-0">
                <button
                  onClick={() => setViewStep('checkout')}
                  className="w-full py-3.5 bg-white hover:bg-white/95 active:scale-98 text-[#4C1829] font-semibold text-xs rounded-2xl shadow-xl transition-all uppercase tracking-wider flex items-center justify-center space-x-2"
                >
                  <span>Proceed to Checkout (₹{grandTotal})</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* Checkout & Payment View */
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1">
              {/* Back to Cart button */}
              <button
                onClick={() => setViewStep('cart')}
                className="flex items-center space-x-1.5 text-xs text-white/80 hover:text-white transition-colors self-start shrink-0"
              >
                <ArrowLeft size={14} />
                <span>Back to Cart Items</span>
              </button>

              {/* Order Items Review with Quick Quantity / Delete Modifier */}
              <div className="space-y-1.5 shrink-0">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>Order Items Review ({cart.length})</span>
                  <span>Adjust or remove items</span>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {cart.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#930E36]/25 border border-[#930E36]/40 text-xs"
                    >
                      <div className="truncate max-w-[55%]">
                        <span className="font-medium text-white">{item.name}</span>
                        <span className="text-white/60 ml-2">₹{item.price * item.quantity}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          onClick={() => handleUpdateQty(item.id, -1)}
                          className="w-5 h-5 bg-white text-[#4C1829] rounded flex items-center justify-center hover:bg-white/90"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQty(item.id, 1)}
                          className="w-5 h-5 bg-white text-[#4C1829] rounded flex items-center justify-center hover:bg-white/90"
                        >
                          <Plus size={11} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-red-300 hover:text-white hover:bg-red-600/80 rounded transition-colors ml-1"
                          title="Remove item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pickup Time Info */}
              <div className="bg-[#930E36]/30 border border-[#930E36]/50 p-3 rounded-2xl flex items-center space-x-3 text-white shrink-0">
                <Clock size={18} className="text-white shrink-0" />
                <div className="text-xs">
                  <p className="font-medium text-white">Estimated Pickup: 10 - 15 Mins</p>
                  <p className="text-[11px] text-white/80">
                    Secret token issued after placement. Show at stall counter for immediate pickup.
                  </p>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-2 shrink-0">
                <label className="block text-[11px] text-white/90 uppercase tracking-wider font-medium">
                  Select Payment Method
                </label>

                <div
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                    paymentMethod === 'UPI'
                      ? 'border-white bg-[#930E36]/60 text-white font-medium shadow-md'
                      : 'border-white/20 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>UPI Payment (GPay, PhonePe, Paytm)</span>
                  </div>
                  {paymentMethod === 'UPI' && <CheckCircle2 size={16} className="text-white" />}
                </div>

                <div
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                    paymentMethod === 'CARD'
                      ? 'border-white bg-[#930E36]/60 text-white font-medium shadow-md'
                      : 'border-white/20 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <span>Debit Card</span>
                  </div>
                  {paymentMethod === 'CARD' && <CheckCircle2 size={16} className="text-white" />}
                </div>

                <div
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-white bg-[#930E36]/60 text-white font-medium shadow-md'
                      : 'border-white/20 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Counter Cash on Pickup</span>
                  </div>
                  {paymentMethod === 'CASH' && <CheckCircle2 size={16} className="text-white" />}
                </div>
              </div>

              {/* Order Final Action */}
              <div className="pt-2 border-t border-[#930E36]/60 flex items-center justify-between shrink-0">
                <div>
                  <span className="block text-[10px] text-white/80 uppercase tracking-wider">
                    Total Payable
                  </span>
                  <span className="text-xl text-white font-bold">₹{grandTotal}</span>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting || cart.length === 0}
                  className="py-3 px-6 bg-white hover:bg-white/95 disabled:opacity-50 text-[#4C1829] font-bold text-xs rounded-2xl shadow-xl transition-all uppercase tracking-wider flex items-center space-x-2"
                >
                  <span>{isSubmitting ? 'Placing Order...' : 'Place Takeaway Order'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
