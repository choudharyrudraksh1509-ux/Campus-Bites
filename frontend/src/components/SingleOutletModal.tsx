import { AlertTriangle, Trash2 } from 'lucide-react';

interface SingleOutletModalProps {
  isOpen: boolean;
  currentShopName: string;
  newShopName: string;
  onConfirmClear: () => void;
  onCancel: () => void;
}

export default function SingleOutletModal({
  isOpen,
  currentShopName,
  newShopName,
  onConfirmClear,
  onCancel,
}: SingleOutletModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#FF004B] text-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-white/30 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/bg-pattern.png')] bg-cover bg-center opacity-15 pointer-events-none mix-blend-overlay"></div>
        
        <div className="relative z-10">
          {/* Warning Icon Badge */}
          <div className="w-14 h-14 bg-white/20 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/30 shadow-md">
            <AlertTriangle size={28} />
          </div>

          <h3 className="text-xl text-white tracking-tight">
            Single-Outlet Order Policy
          </h3>

          <p className="text-xs text-white/90 mt-2 leading-relaxed">
            Your cart currently contains items from <strong className="text-white">{currentShopName}</strong>.
            <br /><br />
            Bites only allows ordering from <strong className="text-white">one outlet per takeaway order</strong> for fast counter pickup.
          </p>

          <div className="my-5 p-3 rounded-2xl bg-white/15 border border-white/30 text-xs text-white flex items-center justify-center space-x-2">
            <span>{currentShopName}</span>
            <span className="text-white/60 uppercase text-[10px]">switch to</span>
            <span className="text-white">{newShopName}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={onCancel}
              className="w-full py-3 bg-white/20 hover:bg-white/30 text-white text-xs rounded-2xl transition-colors uppercase tracking-wider border border-white/30"
            >
              Keep Cart
            </button>
            <button
              onClick={onConfirmClear}
              className="w-full py-3 bg-white hover:bg-white/95 text-[#FF004B] text-xs rounded-2xl shadow-xl transition-all flex items-center justify-center space-x-1.5 uppercase tracking-wider"
            >
              <Trash2 size={16} />
              <span>Clear & Switch</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
