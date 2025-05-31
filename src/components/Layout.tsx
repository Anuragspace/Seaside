import React from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
  hideCreateJoin?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, hideCreateJoin = false }) => {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Ambient lighting effects */}
      <div className="absolute top-[-300px] left-[-300px] w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[150px]" />
      <div className="absolute bottom-[-200px] right-[-200px] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[150px]" />
      <div className="absolute top-[30%] right-[-100px] w-[300px] h-[300px] rounded-full bg-purple-500/10 blur-[100px]" />
      
      <Navbar hideCreateJoin={hideCreateJoin} />
      <main className="relative z-10">
        {children}
      </main>
    </div>
  );
};

export default Layout;