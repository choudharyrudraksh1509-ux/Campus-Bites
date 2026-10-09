import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

interface FloatingCartProps {
  cartCount: number;
}

export default function FloatingCart({ cartCount }: FloatingCartProps) {
  const navigate = useNavigate();

  if (cartCount <= 0) return null;

  return (
    <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 animate-fade-in">
      <button
        onClick={() => navigate('/orders')}
        className="bg-[#4C1829] hover:bg-[#5C1D33] text-white text-xs px-6 py-4 rounded-full shadow-[0_25px_60px_rgba(0,0,0,0.85),0_10px_25px_rgba(76,24,41,0.5)] border border-[#930E36] flex items-center space-x-3 transition-all hover:scale-105 active:scale-95 uppercase tracking-wider relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"></div>
        <div className="relative z-10 flex items-center space-x-3">
          <div className="relative">
            <ShoppingBag size={20} className="text-white" />
            <span className="absolute -top-2 -right-2.5 bg-white text-[#4C1829] text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md font-medium">
              {cartCount}
            </span>
          </div>
          <span>View Cart & Takeaway</span>
        </div>
      </button>
    </div>
  );
}
