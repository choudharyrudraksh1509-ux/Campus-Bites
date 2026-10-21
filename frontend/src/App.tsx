import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import FloatingCart from './components/FloatingCart';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Orders from './pages/Orders';
import StaffDashboard from './pages/StaffDashboard';
import Login from './pages/Login';
import api from './services/api';
import autobookService from './services/autobookService';

function App() {

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('campusbite_user');
      if (saved && saved !== 'undefined') {
        return JSON.parse(saved);
      }
    } catch {
      localStorage.removeItem('campusbite_user');
    }
    return null;
  });

  const [cartCount, setCartCount] = useState(0);

  // Sync cart count from localStorage
  useEffect(() => {
    const updateCount = () => {
      try {
        const savedCart = JSON.parse(localStorage.getItem('campusbite_cart') || '[]');
        const count = Array.isArray(savedCart) ? savedCart.reduce((acc: number, c: any) => acc + (c.quantity || 0), 0) : 0;
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    };

    updateCount();
    const interval = setInterval(updateCount, 1000);
    return () => clearInterval(interval);
  }, []);

  // Automated background runner for daily recurring autobook orders
  useEffect(() => {
    if (!user || user.role === 'STAFF') return;

    const checkSchedules = async () => {
      try {
        const triggered = await autobookService.checkAndRunDueSchedules();
        if (triggered.length > 0) {
          triggered.forEach(t => {
            alert(`⚡ Daily Autobook Triggered!\nYour scheduled daily order for ${t.quantity}x ${t.itemName} at ${t.shopName} has been automatically placed!`);
          });
        }
      } catch (err) {
        console.error('Error running autobook scheduler', err);
      }
    };

    checkSchedules();
    const interval = setInterval(checkSchedules, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch logged in user on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && token !== 'undefined' && !user) {
      api.get('/auth/me')
        .then(res => {
          if (res.data?.user) {
            setUser(res.data.user);
            localStorage.setItem('campusbite_user', JSON.stringify(res.data.user));
          }
        })
        .catch(() => {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('campusbite_user');
        });
    } else if (token === 'undefined') {
      localStorage.removeItem('token');
    }
  }, [user]);

  const handleAuthSuccess = (userData: any, token: string) => {
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('campusbite_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('campusbite_user');
  };

  return (
    <Router>
      <div className="min-h-screen bg-transparent text-white font-sans antialiased selection:bg-red-500 selection:text-white">
        
        {/* Upper Navigation Bar & Mobile App Bar / Bottom Nav - Only when logged in */}
        {user && (
          <Navbar
            user={user}
            onLogout={handleLogout}
            onOpenAuth={() => setIsAuthOpen(true)}
            onUpdateUser={setUser}
            cartCount={cartCount}
          />
        )}

        {/* Floating Bottom Cart Button - Only for students/customers */}
        {user && user.role !== 'STAFF' && <FloatingCart cartCount={cartCount} />}

        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={handleAuthSuccess}
        />

        {/* Main Route Content - Require Auth Gate */}
        {!user ? (
          <main className="w-full min-h-[100dvh] flex items-center justify-center p-0 sm:p-4">
            <Login onSuccess={handleAuthSuccess} />
          </main>
        ) : (
          <main
            style={{
              paddingTop: 'calc(max(env(safe-area-inset-top, 0px), 54px) + 52px)'
            }}
            className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 md:!pt-24 pb-0"
          >
            <Routes>
              {user.role === 'STAFF' ? (
                <>
                  <Route path="/staff" element={<StaffDashboard />} />
                  <Route path="*" element={<Navigate to="/staff" replace />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<Home />} />
                  <Route path="/shop/:shopId/menu" element={<Menu />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/staff" element={<StaffDashboard />} />
                  <Route path="/login" element={<Home />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              )}
            </Routes>
          </main>
        )}
      </div>
    </Router>
  );
}

export default App;
