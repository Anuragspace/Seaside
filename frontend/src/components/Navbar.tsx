import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Moon, Sun } from 'lucide-react';
import { useTimeOfDay } from '../hooks/useTimeOfDay';

interface NavbarProps {
  hideCreateJoin?: boolean;
}

const Navbar: React.FC<NavbarProps> = () => {
  const today = new Date();
  const formattedDate = format(today, "EEEE do MMMM");
  const { isDay } = useTimeOfDay();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-transparent backdrop-blur-sm">
      <Link to="/" className="text-2xl font-bold tracking-tight text-white">
        SeaSide
      </Link>

      <div className="flex items-center">
        <div className="flex items-center px-4 py-2 rounded-full bg-gray-800/40 backdrop-blur-md">
          {isDay ? (
            <Sun size={18} className="text-yellow-400 mr-2" />
          ) : (
            <Moon size={18} className="text-blue-300 mr-2" />
          )}
          <span className="text-sm font-medium">{formattedDate}</span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;