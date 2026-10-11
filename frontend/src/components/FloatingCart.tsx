import { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import CartModal from './CartModal';

interface FloatingCartProps {
  cartCount: number;
}

export default function FloatingCart({ cartCount }: FloatingCartProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dynamicCount, setDynamicCount] = useState(cartCount);

  useEffect(() => {
    setDynamicCount(cartCount);
  }, [cartCount]);

  useEffect(() => {
    const updateBadge = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('campusbite_cart') || '[]');
        const count = Array.isArray(saved)
          ? saved.reduce((acc: number, c: any) => acc + (c.quantity || 0), 0)
          : 0;
        setDynamicCount(count);
      } catch {
        setDynamicCount(0);
      }
    };

    window.addEventListener('cartUpdated', updateBadge);
    window.addEventListener('storage', updateBadge);
    return () => {
      window.removeEventListener('cartUpdated', updateBadge);
      window.removeEventListener('storage', updateBadge);
    };
  }, []);

  if (dynamicCount <= 0 && !isModalOpen) return null;

  return (
    <>
      {dynamicCount > 0 && (
        <div className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-40 animate-fade-in">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#4C1829] hover:bg-[#5C1D33] text-white text-xs px-6 py-4 rounded-full shadow-[0_25px_60px_rgba(0,0,0,0.85),0_10px_25px_rgba(76,24,41,0.5)] border border-[#930E36] flex items-center space-x-3 transition-all hover:scale-105 active:scale-95 uppercase tracking-wider relative overflow-hidden"
            aria-label="Open Cart and Takeaway Checkout"
          >
            <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"></div>
            <div className="relative z-10 flex items-center space-x-3">
              <div className="relative">
                <ShoppingBag size={20} className="text-white" />
                <span className="absolute -top-2 -right-2.5 bg-white text-[#4C1829] text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md font-bold">
                  {dynamicCount}
                </span>
              </div>
              <span className="font-medium">View Cart & Checkout</span>
            </div>
          </button>
        </div>
      )}

      {/* Cart Modal opened on-screen */}
      <CartModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
