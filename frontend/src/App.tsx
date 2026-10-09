import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Menu from './pages/Menu';
import Orders from './pages/Orders';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#FAFAFA] text-gray-900 font-sans">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/shop/:shopId/menu" element={<Menu />} />
            <Route path="/orders" element={<Orders />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
