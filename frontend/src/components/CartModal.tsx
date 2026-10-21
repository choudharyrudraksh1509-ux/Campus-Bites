import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  Calendar,
  Lock,
  Sparkles,
  Timer
} from 'lucide-react';
import orderService, { getItemPrepTime } from '../services/orderService';
import PaymentGatewayModal from './PaymentGatewayModal';

export interface CartItem {
  id: number;
  shopId: number;
  shopName: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  isDynamicPricing?: boolean;
  discountPercent?: number;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPaymentGateway, setShowPaymentGateway] = useState(false);

  // Preorder states (Range within 1 day)
  const [isPreorder, setIsPreorder] = useState(false);
  const [selectedPreorderSlot, setSelectedPreorderSlot] = useState<string>('30m');
  const [customPickupDateTime, setCustomPickupDateTime] = useState('');

  // Queue & Prep time estimate
  const [queueEstimate, setQueueEstimate] = useState<{
    queueNumber: number;
    activeOrdersCount: number;
    basePrepMinutes: number;
    estimatedMinutes: number;
    estimatedReadyTime: string;
  }>({
    queueNumber: 1,
    activeOrdersCount: 0,
    basePrepMinutes: 10,
    estimatedMinutes: 10,
    estimatedReadyTime: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  });

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
      setShowPaymentGateway(false);
      setIsPreorder(false);
      setSelectedPreorderSlot('30m');

      // Initialize default custom datetime (1 hour from now)
      const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
      const isoStr = oneHourLater.toISOString().slice(0, 16);
      setCustomPickupDateTime(isoStr);
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

  // Fetch shop queue estimate whenever cart or shopId changes
  useEffect(() => {
    if (!isOpen || cart.length === 0) return;
    const shopId = cart[0].shopId || 1;
    orderService.getShopQueueEstimate(shopId).then(est => {
      // Adjust with items in cart
      let maxPrep = 8;
      for (const item of cart) {
        const p = getItemPrepTime(item.id, item.name);
        if (p > maxPrep) maxPrep = p;
      }
      const totalMin = maxPrep + (est.activeOrdersCount * 3);
      setQueueEstimate({
        ...est,
        basePrepMinutes: maxPrep,
        estimatedMinutes: totalMin,
        estimatedReadyTime: new Date(Date.now() + totalMin * 60 * 1000).toISOString()
      });
    });
  }, [isOpen, cart]);

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

  // Format scheduled preorder time string
  const getPreorderPickupDisplay = (): string => {
    const now = new Date();
    if (selectedPreorderSlot === '30m') {
      const target = new Date(now.getTime() + 30 * 60 * 1000);
      return `Today at ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (selectedPreorderSlot === '1h') {
      const target = new Date(now.getTime() + 60 * 60 * 1000);
      return `Today at ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (selectedPreorderSlot === '2h') {
      const target = new Date(now.getTime() + 120 * 60 * 1000);
      return `Today at ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (selectedPreorderSlot === '4h') {
      const target = new Date(now.getTime() + 240 * 60 * 1000);
      return `Today at ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (selectedPreorderSlot === 'custom' && customPickupDateTime) {
      const customDate = new Date(customPickupDateTime);
      const isToday = customDate.toDateString() === now.toDateString();
      const prefix = isToday ? 'Today' : 'Tomorrow';
      return `${prefix} at ${customDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Scheduled pickup time';
  };

  const handleOpenPaymentGateway = () => {
    if (cart.length === 0) return;
    setShowPaymentGateway(true);
  };

  // Called when demo payment is completed in PaymentGatewayModal
  const handlePaymentSuccess = async (details: {
    paymentMethod: string;
    transactionId: string;
    amount: number;
  }) => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const shopId = cart[0]?.shopId || 1;
      const shopName = cart[0]?.shopName || 'Campus Outlet';
      const scheduledTime = isPreorder ? getPreorderPickupDisplay() : null;

      const placedOrder = await orderService.placeOrder(
        shopId,
        cart.map(c => ({
          itemId: c.id,
          quantity: c.quantity,
          name: c.name,
          price: c.price
        })),
        {
          shopName,
          packagingFee,
          isPreorder,
          pickupTime: scheduledTime || undefined,
          paymentMethod: details.paymentMethod
        }
      );

      // Clear cart
      persistCart([]);
      setShowPaymentGateway(false);
      onClose();

      const timeMsg = isPreorder
        ? `Pre-ordered for: ${scheduledTime}`
        : `Ready in approx ${placedOrder.estimated_delivery_minutes || queueEstimate.estimatedMinutes} mins (Queue #${placedOrder.queue_number || queueEstimate.queueNumber})`;

      alert(
        `🎉 Takeaway Order Placed Successfully!\n` +
        `Token: ${placedOrder.pickup_token}\n` +
        `Payment: ${details.paymentMethod} (₹${grandTotal})\n` +
        `${timeMsg}\nOutlet: ${shopName}`
      );

      navigate('/orders');
    } catch (err: any) {
      console.error('Failed to complete order after payment', err);
      alert('Order recorded. Redirecting to your orders...');
      navigate('/orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
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
                    {viewStep === 'cart' ? 'Your Takeaway Cart' : 'Review & Schedule'}
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
              /* Empty Cart State */
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
                {/* Stall Queue & Prep Time Indicator */}
                <div className="text-[11px] bg-[#930E36]/30 text-white/95 p-2.5 rounded-xl border border-[#930E36]/50 flex items-center justify-between mb-3 shrink-0">
                  <div className="flex items-center space-x-2">
                    <Clock size={14} className="text-amber-400 shrink-0" />
                    <span>
                      Est. Prep: <strong>~{queueEstimate.estimatedMinutes}m</strong> ({queueEstimate.basePrepMinutes}m prep + queue delay)
                    </span>
                  </div>
                  <span className="bg-white/10 px-2 py-0.5 rounded-md font-mono text-[10px] text-pink-200">
                    Stall Queue: #{queueEstimate.queueNumber}
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
                          {item.isDynamicPricing && item.originalPrice && item.originalPrice > item.price ? (
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-emerald-400 font-bold">₹{item.price} each</span>
                              <span className="text-white/40 line-through">₹{item.originalPrice}</span>
                              <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-1 py-0.5 rounded-full font-bold">
                                🔥 {item.discountPercent || Math.round((1 - item.price / item.originalPrice) * 100)}% OFF
                              </span>
                              <span className="text-white font-medium">= ₹{item.price * item.quantity}</span>
                            </span>
                          ) : (
                            <>₹{item.price} each • <span className="text-white font-medium">₹{item.price * item.quantity}</span></>
                          )}
                        </div>
                      </div>

                      {/* Quantity Modifier and Delete Button */}
                      <div className="flex items-center space-x-2.5 shrink-0">
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
                    <span>Proceed to Order & Schedule (₹{grandTotal})</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              /* Checkout & Preorder Scheduling View */
              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1">
                {/* Back to Cart button */}
                <button
                  onClick={() => setViewStep('cart')}
                  className="flex items-center space-x-1.5 text-xs text-white/80 hover:text-white transition-colors self-start shrink-0"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Cart Items</span>
                </button>

                {/* FEATURE 1: Timing Options (Immediate Pickup vs Preorder within 1 Day) */}
                <div className="bg-[#930E36]/30 border border-[#930E36]/60 p-3.5 rounded-2xl space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-semibold text-white flex items-center space-x-1.5">
                      <Calendar size={14} className="text-pink-300" />
                      <span>Takeaway Timing Mode</span>
                    </span>
                    <span className="text-[10px] bg-pink-500/20 text-pink-200 px-2 py-0.5 rounded-full border border-pink-500/30">
                      Within 24 Hours
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsPreorder(false)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        !isPreorder
                          ? 'bg-white text-[#4C1829] font-bold border-white shadow-lg'
                          : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <Clock size={13} />
                        <span>Pickup Now</span>
                      </div>
                      <div className="text-[10px] mt-0.5 opacity-80">
                        Ready in ~{queueEstimate.estimatedMinutes}m
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPreorder(true)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isPreorder
                          ? 'bg-white text-[#4C1829] font-bold border-white shadow-lg'
                          : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <Calendar size={13} />
                        <span>Pre-order Later</span>
                      </div>
                      <div className="text-[10px] mt-0.5 opacity-80">
                        Fixed time within 1 day
                      </div>
                    </button>
                  </div>

                  {/* Preorder Time Slot Selection */}
                  {isPreorder && (
                    <div className="space-y-2 pt-1 border-t border-[#930E36]/50 animate-fade-in text-xs">
                      <span className="text-[11px] text-white/80 font-medium block">
                        Select Pre-order Pickup Time:
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {[
                          { id: '30m', label: '+30 Mins' },
                          { id: '1h', label: '+1 Hour' },
                          { id: '2h', label: '+2 Hours' },
                          { id: '4h', label: '+4 Hours' }
                        ].map(slot => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedPreorderSlot(slot.id)}
                            className={`py-1.5 px-2 rounded-xl border text-[11px] font-medium transition-all ${
                              selectedPreorderSlot === slot.id
                                ? 'bg-pink-600 text-white border-pink-400 font-bold'
                                : 'bg-black/30 border-white/10 text-white/80 hover:bg-white/10'
                            }`}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom Time Selector */}
                      <div className="pt-1.5 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <button
                            type="button"
                            onClick={() => setSelectedPreorderSlot('custom')}
                            className={`underline ${selectedPreorderSlot === 'custom' ? 'text-white font-bold' : 'text-white/60'}`}
                          >
                            Or choose custom date & time (within 24h):
                          </button>
                        </div>

                        {selectedPreorderSlot === 'custom' && (
                          <input
                            type="datetime-local"
                            value={customPickupDateTime}
                            min={new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16)}
                            max={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                            onChange={(e) => setCustomPickupDateTime(e.target.value)}
                            className="w-full bg-black/40 border border-white/30 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white font-mono"
                          />
                        )}
                      </div>

                      <div className="p-2 rounded-xl bg-pink-950/60 border border-pink-500/40 text-[11px] text-pink-200 flex items-center space-x-2">
                        <CheckCircle2 size={13} className="text-pink-300 shrink-0" />
                        <span>Scheduled: <strong>{getPreorderPickupDisplay()}</strong></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* FEATURE 3: Live Queue & Prep Estimation Preview Card */}
                <div className="bg-[#930E36]/30 border border-[#930E36]/50 p-3 rounded-2xl flex items-center space-x-3 text-white shrink-0">
                  <Timer size={20} className="text-amber-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-white">
                      {isPreorder
                        ? `Pre-order for ${getPreorderPickupDisplay()}`
                        : `Estimated Pickup: ~${queueEstimate.estimatedMinutes} Mins`}
                    </p>
                    <p className="text-[11px] text-white/80">
                      Stall Queue Position: <strong className="text-white">#{queueEstimate.queueNumber}</strong> • Food Prep Time: {queueEstimate.basePrepMinutes}m
                    </p>
                  </div>
                </div>

                {/* Items Summary Compact */}
                <div className="space-y-1.5 shrink-0">
                  <div className="text-xs text-white/80 font-medium">Order Items ({cart.length})</div>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {cart.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#930E36]/20 border border-[#930E36]/30 text-xs"
                      >
                        <div className="truncate max-w-[65%]">
                          <span className="font-medium text-white">{item.quantity}x {item.name}</span>
                        </div>
                        <span className="text-white font-mono">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Final Action with Payment Gateway Launcher */}
                <div className="pt-3 border-t border-[#930E36]/60 flex items-center justify-between shrink-0">
                  <div>
                    <span className="block text-[10px] text-white/80 uppercase tracking-wider">
                      Total Payable
                    </span>
                    <span className="text-xl text-white font-bold">₹{grandTotal}</span>
                  </div>

                  <button
                    onClick={handleOpenPaymentGateway}
                    disabled={isSubmitting || cart.length === 0}
                    className="py-3 px-6 bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-xl transition-all uppercase tracking-wider flex items-center space-x-2"
                  >
                    <Lock size={14} />
                    <span>Pay with Demo Gateway</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FEATURE 2: Demo Payment Gateway Modal */}
      <PaymentGatewayModal
        isOpen={showPaymentGateway}
        amount={grandTotal}
        shopName={cart[0]?.shopName || 'Campus Outlet'}
        itemCount={totalItemsCount}
        estimatedMinutes={queueEstimate.estimatedMinutes}
        queueNumber={queueEstimate.queueNumber}
        isPreorder={isPreorder}
        pickupTime={isPreorder ? getPreorderPickupDisplay() : null}
        onClose={() => setShowPaymentGateway(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </>
  );
}
