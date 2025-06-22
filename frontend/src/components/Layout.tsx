import React from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
  showNavbar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showNavbar = true }) => (
  <div className="min-h-screen bg-black text-white overflow-hidden relative">
    {/* Ambient lighting effects */}
    <div className="absolute top-[-300px] left-[-300px] w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[150px]" />
    <div className="absolute bottom-[-200px] right-[-200px] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[150px]" />
    <div className="absolute top-[30%] right-[-100px] w-[300px] h-[300px] rounded-full bg-purple-500/10 blur-[100px]" />
    
    {showNavbar && <Navbar />}
    <main className={`relative z-10 ${showNavbar ? 'pt-20' : ''}`}>
      {children}
    </main>
  </div>
);

export default Layout;