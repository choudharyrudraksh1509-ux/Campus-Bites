import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Utensils, ShoppingBag, User, LogOut, LayoutDashboard, Search } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navClass = (path: string) => 
    `flex items-center space-x-2 text-sm font-medium px-3 py-2 rounded-md transition-colors ${
      location.pathname === path ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
    }`;

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2 text-black font-semibold text-lg tracking-tight">
              <Utensils size={20} className="text-gray-700" />
              <span>CampusBite</span>
            </Link>

            <div className="hidden md:flex space-x-1">
              <Link to="/" className={navClass('/')}>
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </Link>
              <Link to="/orders" className={navClass('/orders')}>
                <ShoppingBag size={16} />
                <span>Orders</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative hidden sm:block">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-md text-sm bg-gray-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent transition-all w-64"
              />
            </div>
            
            {user ? (
              <div className="flex items-center space-x-4 ml-4 border-l pl-4">
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-gray-700 to-gray-900 flex items-center justify-center text-white font-bold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-gray-700 font-medium hidden sm:inline">{user.name}</span>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 ml-4 border-l pl-4">
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Log In
                </Link>
                <Link to="/login" className="text-sm font-medium bg-black text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
