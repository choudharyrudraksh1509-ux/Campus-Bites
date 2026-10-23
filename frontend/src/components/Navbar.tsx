import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Store, Clock, ShoppingBag, User as UserIcon, Shield } from 'lucide-react';
import ProfileModal from './ProfileModal';
import CartModal from './CartModal';

interface NavbarProps {
  user?: any;
  onLogout?: () => void;
  onOpenAuth?: () => void;
  onUpdateUser?: (user: any) => void;
  cartCount?: number;
}

export default function Navbar({ user, onLogout, onOpenAuth, onUpdateUser, cartCount: propCartCount = 0 }: NavbarProps) {
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(propCartCount);

  // Sync cart count reactively for mobile badge
  useEffect(() => {
    setCartCount(propCartCount);
  }, [propCartCount]);

  useEffect(() => {
    const updateCount = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('campusbite_cart') || '[]');
        const count = Array.isArray(saved)
          ? saved.reduce((acc: number, c: any) => acc + (c.quantity || 0), 0)
          : 0;
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    };

    window.addEventListener('cartUpdated', updateCount);
    window.addEventListener('storage', updateCount);
    return () => {
      window.removeEventListener('cartUpdated', updateCount);
      window.removeEventListener('storage', updateCount);
    };
  }, []);

  return (
    <>
      {/* ======================================================== */}
      {/* 1. DESKTOP / LAPTOP / TABLET FLOATING NAVBAR (md and up) */}
      {/* ======================================================== */}
      <header
        style={{
          top: 'max(env(safe-area-inset-top, 0px), 1rem)'
        }}
        className="hidden md:grid fixed left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] backdrop-blur-xl bg-[#1D1D21]/90 border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.6)] grid-cols-3 items-center px-6 py-3.5 transition-all"
      >
        
        {/* Column 1 (Left): Navigation Links - Removed Outlets & Activity for Staff */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {user?.role !== 'STAFF' && (
            <>
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
            </>
          )}
          {user && (user.role === 'ADMIN' || user.role === 'OWNER') && (
            <Link
              to="/admin"
              className={`text-xs px-3.5 py-1.5 rounded-full transition-all flex items-center space-x-1.5 ${
                location.pathname === '/admin' ? 'bg-red-600/30 text-red-400 border border-red-500/50 shadow-sm' : 'text-red-400/80 hover:text-red-300'
              }`}
            >
              <Shield size={13} className="text-red-400" />
              <span>Admin Hub</span>
            </Link>
          )}
          {user && user.role === 'STAFF' && (
            <Link
              to="/staff"
              className={`text-xs px-3.5 py-1.5 rounded-full transition-all flex items-center space-x-1.5 ${
                location.pathname === '/staff' ? 'bg-[#930E36]/30 text-[#FF004B] border border-[#930E36]/50' : 'text-[#FF004B]/80 hover:text-[#FF004B]'
              }`}
            >
              <Store size={13} />
              <span>{user?.shopName || 'Staff Portal'}</span>
            </Link>
          )}
        </div>

        {/* Column 2 (Center): Brand Name 'Bites' strictly centered */}
        <div className="text-center">
          <Link to={user?.role === 'STAFF' ? '/staff' : '/'} className="inline-block group">
            <span className="text-xl tracking-tight text-white group-hover:text-[#FF004B] transition-colors">
              Bites
            </span>
          </Link>
        </div>

        {/* Column 3 (Right): Auth / User Profile */}
        <div className="flex items-center justify-end space-x-2">
          {user ? (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                title="View & Edit Profile"
                className="flex items-center space-x-2 p-1 rounded-full hover:bg-white/10 transition-all group cursor-pointer focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-[#4C1829] text-white border border-[#930E36] flex items-center justify-center text-xs font-semibold shadow-md group-hover:border-white/50 transition-colors">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-xs text-white/90 group-hover:text-white font-medium hidden sm:inline max-w-[90px] truncate">
                  {user.name || 'Profile'}
                </span>
              </button>
              <button
                onClick={onLogout}
                title="Logout"
                className="p-1.5 text-white/50 hover:text-white rounded-full transition-colors cursor-pointer"
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

      {/* ======================================================== */}
      {/* 2. MOBILE TOP APP BAR (phones < md)                      */}
      {/* ======================================================== */}
      <header
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 54px)',
          paddingBottom: '10px'
        }}
        className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#1D1D21] backdrop-blur-xl border-b border-white/10 px-4 flex items-center justify-between shadow-md"
      >
        <Link to={user?.role === 'STAFF' ? '/staff' : '/'} className="flex items-center space-x-2 group">
          <span className="text-lg font-bold tracking-tight text-white group-hover:text-[#FF004B] transition-colors">
            Bites
          </span>
          <span className="text-[10px] bg-[#930E36]/50 border border-[#930E36]/70 text-white/90 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
            {user?.role === 'ADMIN' ? 'Tech Admin' : user?.role === 'STAFF' ? (user?.shopName || 'Staff Portal') : 'VIT Campus'}
          </span>
        </Link>

        <div className="flex items-center space-x-2">
          {user ? (
            <>
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center space-x-1.5 bg-[#4C1829] text-white border border-[#930E36] px-2.5 py-1 rounded-full text-xs shadow-sm active:scale-95 transition-transform"
              >
                <div className="w-5 h-5 rounded-full bg-white text-[#4C1829] flex items-center justify-center text-[10px] font-bold">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="max-w-[70px] truncate text-[11px] font-medium">{user.name || 'Profile'}</span>
              </button>
              <button
                onClick={onLogout}
                title="Logout"
                className="p-1.5 text-white/50 hover:text-white rounded-full transition-colors active:scale-90"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="bg-[#4C1829] hover:bg-[#5C1D33] text-white border border-[#930E36] text-xs px-3 py-1 rounded-full"
            >
              Log In
            </Link>
          )}
        </div>
      </header>

      {/* ======================================================== */}
      {/* 3. MOBILE NATIVE BOTTOM NAVIGATION BAR (phones < md)     */}
      {/* ======================================================== */}
      <nav
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 14px)',
          paddingTop: '8px'
        }}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1D1D21]/95 backdrop-blur-xl border-t border-[#930E36]/30 px-2 flex items-center justify-around shadow-[0_-10px_25px_rgba(0,0,0,0.5)]"
      >
        {user?.role !== 'STAFF' ? (
          <>
            <Link
              to="/"
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all ${
                location.pathname === '/' ? 'text-white font-medium' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Store size={20} className={location.pathname === '/' ? 'text-white' : 'text-white/50'} />
              <span className="text-[10px] mt-0.5 tracking-tight">Outlets</span>
            </Link>

            <Link
              to="/orders"
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all ${
                location.pathname === '/orders' ? 'text-white font-medium' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Clock size={20} className={location.pathname === '/orders' ? 'text-white' : 'text-white/50'} />
              <span className="text-[10px] mt-0.5 tracking-tight">Activity</span>
            </Link>

            <button
              onClick={() => setIsCartOpen(true)}
              className="flex flex-col items-center py-1 px-3 rounded-2xl text-white/50 hover:text-white/80 transition-all relative"
              aria-label="View Cart"
            >
              <div className="relative">
                <ShoppingBag size={20} className="text-white/70" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-white text-[#4C1829] text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-md">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Cart</span>
            </button>
          </>
        ) : (
          <Link
            to="/staff"
            className={`flex flex-col items-center py-1 px-4 rounded-2xl transition-all ${
              location.pathname === '/staff' ? 'text-[#FF004B] font-semibold' : 'text-white/60 hover:text-white'
            }`}
          >
            <Shield size={20} />
            <span className="text-[10px] mt-0.5 tracking-tight">Portal</span>
          </Link>
        )}

        <button
          onClick={() => setIsProfileOpen(true)}
          className="flex flex-col items-center py-1 px-3 rounded-2xl text-white/50 hover:text-white/80 transition-all"
          aria-label="View Profile"
        >
          <UserIcon size={20} className="text-white/70" />
          <span className="text-[10px] mt-0.5 tracking-tight">Profile</span>
        </button>
      </nav>

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />

      {/* Profile Modal */}
      {user && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          user={user}
          onUpdateUser={onUpdateUser}
        />
      )}
    </>
  );
}

