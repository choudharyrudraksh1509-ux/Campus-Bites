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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-fade-in">
      <div className="bg-[#4C1829] text-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.95)] border border-[#930E36] text-center relative overflow-hidden">
        <div className="relative z-10">
          {/* Warning Icon Badge */}
          <div className="w-14 h-14 bg-[#930E36]/50 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 border border-[#930E36] shadow-md">
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

          <div className="my-5 p-3 rounded-2xl bg-[#930E36]/30 border border-[#930E36]/60 text-xs text-white flex items-center justify-center space-x-2">
            <span>{currentShopName}</span>
            <span className="text-white/60 uppercase text-[10px]">switch to</span>
            <span className="text-white">{newShopName}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={onCancel}
              className="w-full py-3 bg-[#930E36]/30 hover:bg-[#930E36]/50 text-white text-xs rounded-2xl transition-colors uppercase tracking-wider border border-[#930E36]/70"
            >
              Keep Cart
            </button>
            <button
              onClick={onConfirmClear}
              className="w-full py-3 bg-white hover:bg-white/95 text-[#4C1829] font-medium text-xs rounded-2xl shadow-xl transition-all flex items-center justify-center space-x-1.5 uppercase tracking-wider"
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
