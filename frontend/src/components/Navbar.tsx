import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Moon, Sun, User, X, Menu, LogOut } from 'lucide-react';
import { useTimeOfDay } from '../hooks/useTimeOfDay';
import { useAuth } from '../contexts/AuthContext';
import { Avatar, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import LoadingSkeleton from './LoadingSkeleton';

interface NavbarProps {
  // No longer need user prop since we get it from auth context
}

export default function Navbar({}: NavbarProps) {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = window.location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // check if we are on the homepage
  const isCorrect = pathname === "/";

  // Close mobile menu when window is resized to desktop size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle body scroll lock when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // Handle clicks outside the mobile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        // Check if the click is not on the menu button (which has its own handler)
        const target = event.target as HTMLElement;
        if (!target.closest('[data-menu-button="true"]')) {
          setIsMobileMenuOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error('Sign out error:', error);
      // Navigate anyway since signOut clears local state
      navigate("/");
    }
  };

  // Debug logging for auth state
  console.log('Navbar Auth State:', {
    user,
    isAuthenticated,
    isLoading,
    tokens: {
      accessToken: localStorage.getItem('auth_access_token'),
      refreshToken: localStorage.getItem('auth_refresh_token')
    }
  });

  // Process user data with defaults if not provided
  const userDetails = {
    initials: user
      ? user.username
          .split(" ")
          .map((name) => name?.[0] || "")
          .join("")
          .toUpperCase() || "U"
      : "U",
    displayName: user?.username || "User",
    email: user?.email || "",
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };


  const today = new Date();
  const formattedDate = format(today, "EEEE do MMMM");
  const { isDay } = useTimeOfDay();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-transparent backdrop-blur-sm">
      <Link to="/" className="text-2xl font-bold tracking-tight text-white">
        SeaSide
      </Link>

      <div className='hidden md:flex gap-4 items-center'>
        {isLoading && (
          <LoadingSkeleton variant="navbar" />
        )}
        
        {!isAuthenticated && !isLoading && (
          <>
            <Link to="/sign-in">
              <Button variant='flat' color="primary">
                Sign In
              </Button>
            </Link>
            <Link to='/sign-up'>
              <Button variant='flat' color="primary">
                Sign Up
              </Button>
            </Link>
          </>
        )}

        {isAuthenticated && !isLoading && (
          <div className='flex items-center gap-4'>
            {!isCorrect && (
              <Link to="/">
                <Button variant='flat' color='primary'>
                  Dashboard
                </Button>
              </Link>
            )}
            
            {/* User profile dropdown */}
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Avatar
                  name={userDetails.initials}
                  size='sm'
                  src={user?.avatar || undefined}
                  className='h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity'
                  fallback={<User className='h-4 w-4' />}
                />
              </DropdownTrigger>
              <DropdownMenu aria-label="User menu">
                <DropdownItem key="profile" className="h-14 gap-2">
                  <p className="font-semibold">Signed in as</p>
                  <p className="font-semibold">{userDetails.email}</p>
                </DropdownItem>
                <DropdownItem key="settings">
                  Profile Settings
                </DropdownItem>
                <DropdownItem 
                  key="logout" 
                  color="danger"
                  startContent={<LogOut className="h-4 w-4" />}
                  onPress={handleSignOut}
                >
                  Sign Out
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        )}
      </div>

      {/* for mobile menu */}
      <div className='md:hidden flex items-center gap-3'>
        {isLoading && (
          <LoadingSkeleton variant="profile" className="h-8" />
        )}
        
        {isAuthenticated && !isLoading && (
          <Avatar
            name={userDetails.initials}
            size='sm'
            src={user?.avatar || undefined}
            className='h-8 w-8 flex-shrink-0'
            fallback={<User className='h-4 w-4' />}
          />
        )}
        <button
              className="z-50 p-2"
              onClick={toggleMobileMenu}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              data-menu-button="true"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6 text-default-700" />
              ) : (
                <Menu className="h-6 w-6 text-default-700" />
              )}
            </button>
      </div>

      {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/20 z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />
          )}


           <div ref={mobileMenuRef}
            className={`fixed top-0 right-0 bottom-0 w-4/5 max-w-sm bg-default-50 z-40 flex flex-col pt-20 px-6 shadow-xl transition-transform duration-300 ease-in-out ${
              isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
            } md:hidden`}
          >
            {isLoading && (
              <div className="flex flex-col gap-4 items-center">
                <LoadingSkeleton variant="button" />
                <LoadingSkeleton variant="button" />
              </div>
            )}
            
            {!isAuthenticated && !isLoading && (
              <div className="flex flex-col gap-4 items-center">
                <Link
                  to="/sign-in"
                  className="w-full"
                >
                  <Button variant="flat" color="primary" className="w-full" onPress={() => setIsMobileMenuOpen(false)}>
                    Sign In
                  </Button>
                </Link>
                <Link
                  to="/sign-up"
                  className="w-full"
                >
                  <Button variant="solid" color="primary" className="w-full" onPress={() => setIsMobileMenuOpen(false)}>
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}

            {isAuthenticated && !isLoading && (
              <div className="flex flex-col gap-6">
                {/* User info */}
                <div className="flex items-center gap-3 py-4 border-b border-default-200">
                  <Avatar
                    name={userDetails.initials}
                    size="md"
                    src={user?.avatar || undefined}
                    className="h-10 w-10 flex-shrink-0"
                    fallback={<User className="h-5 w-5" />}
                  />
                  <div>
                    <p className="font-medium">{userDetails.displayName}</p>
                    <p className="text-sm text-default-500">
                      {userDetails.email}
                    </p>
                  </div>
                </div>

                {/* Navigation links */}
                <div className="flex flex-col gap-4">
                  {!isCorrect && (
                    <Link
                      to="/"
                      className="py-2 px-3 hover:bg-default-100 rounded-md transition-colors"
                    >
                      <Button variant="light" color="primary" onPress={() => setIsMobileMenuOpen(false)}>
                        Dashboard
                      </Button>
                    </Link>
                  )}
                  <Link
                    to="/profile"
                    className="py-2 px-3 hover:bg-default-100 rounded-md transition-colors"
                  >
                    <Button variant="light" color="primary" onPress={() => setIsMobileMenuOpen(false)}>
                      Profile
                    </Button>
                  </Link>
                  <button
                    className="py-2 px-3 text-left text-danger hover:bg-danger-50 rounded-md transition-colors mt-4"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleSignOut();
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

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