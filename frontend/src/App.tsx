import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import FloatingCart from './components/FloatingCart';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Orders from './pages/Orders';
import Login from './pages/Login';
import api from './services/api';

function App() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('campusbite_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [cartCount, setCartCount] = useState(0);

  // Sync cart count from localStorage
  useEffect(() => {
    const updateCount = () => {
      const savedCart = JSON.parse(localStorage.getItem('campusbite_cart') || '[]');
      const count = savedCart.reduce((acc: number, c: any) => acc + c.quantity, 0);
      setCartCount(count);
    };

    updateCount();
    const interval = setInterval(updateCount, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch logged in user on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !user) {
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
        
        {/* Floating Upper Navigation Bar - Only when logged in */}
        {user && (
          <Navbar
            user={user}
            onLogout={handleLogout}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {/* Floating Bottom Cart Button - Only when logged in */}
        {user && <FloatingCart cartCount={cartCount} />}

        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={handleAuthSuccess}
        />

        {/* Main Route Content - Require Auth Gate */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {!user ? (
            <Login onSuccess={handleAuthSuccess} />
          ) : (
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/shop/:shopId/menu" element={<Menu />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/login" element={<Home />} />
            </Routes>
          )}
        </main>
      </div>
    </Router>
  );
}

export default App;
