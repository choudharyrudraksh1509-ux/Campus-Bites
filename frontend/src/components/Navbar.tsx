import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';

interface NavbarProps {
  user?: any;
  onLogout?: () => void;
  onOpenAuth?: () => void;
}

export default function Navbar({ user, onLogout, onOpenAuth }: NavbarProps) {
  const location = useLocation();

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] backdrop-blur-xl bg-[#1D1D21]/90 border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.6)] grid grid-cols-3 items-center px-6 py-3.5 transition-all">
      
      {/* Column 1 (Left): Navigation Links */}
      <div className="flex items-center space-x-1 sm:space-x-2">
        <Link
          to="/"
          className={`text-xs px-3.5 py-1.5 rounded-full transition-all ${
            location.pathname === '/' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
          }`}
        >
          Outlets
        </Link>
        <Link
          to="/orders"
          className={`text-xs px-3.5 py-1.5 rounded-full transition-all ${
            location.pathname === '/orders' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
          }`}
        >
          Activity
        </Link>
      </div>

      {/* Column 2 (Center): Brand Name 'Bites' strictly centered */}
      <div className="text-center">
        <Link to="/" className="inline-block group">
          <span className="text-xl tracking-tight text-white group-hover:text-[#FF004B] transition-colors">
            Bites
          </span>
        </Link>
      </div>

      {/* Column 3 (Right): Auth / User Profile */}
      <div className="flex items-center justify-end space-x-2">
        {user ? (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-[#4C1829] text-white border border-[#930E36] flex items-center justify-center text-xs shadow-md">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-white/50 hover:text-white rounded-full transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="bg-[#4C1829] hover:bg-[#5C1D33] text-white border border-[#930E36] text-xs px-4 py-2 rounded-full transition-all shadow-lg shadow-[#4C1829]/50"
          >
            Log In
          </Link>
        )}
      </div>

    </header>
  );
}
