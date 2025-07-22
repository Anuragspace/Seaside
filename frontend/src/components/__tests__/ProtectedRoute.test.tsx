import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProtectedRoute, PublicOnlyRoute, withProtectedRoute } from '../ProtectedRoute';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the auth context
const mockAuthContext = {
  user: null as any,
  isAuthenticated: false,
  isLoading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  refreshToken: vi.fn(),
};

// Mock AuthProvider
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuthContext,
}));

// Test components
const TestComponent = () => <div>Protected Content</div>;
const PublicComponent = () => <div>Public Content</div>;

// Test wrapper with router
const TestWrapper: React.FC<{ 
  children: React.ReactNode; 
  initialEntries?: string[];
}> = ({ children, initialEntries = ['/'] }) => (
  <MemoryRouter initialEntries={initialEntries}>
    <AuthProvider>
      <Routes>
        <Route path="/sign-in" element={<div>Sign In Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/custom-login" element={<div>Custom Login</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        {children}
      </Routes>
    </AuthProvider>
  </MemoryRouter>
);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock auth context to default state
    mockAuthContext.user = null;
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.isLoading = false;
  });

  describe('when user is authenticated', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      };
    });

    it('should render protected content for authenticated users', () => {
      render(
        <TestWrapper initialEntries={['/test']}>
          <Route path="/test" element={
            <ProtectedRoute>
              <TestComponent />
            </ProtectedRoute>
          } />
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should render content when requireAuth is false', () => {
      render(
        <TestWrapper initialEntries={['/test']}>
          <Route path="/test" element={
            <ProtectedRoute requireAuth={false}>
              <TestComponent />
            </ProtectedRoute>
          } />
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('when user is not authenticated', () => {
    it('should redirect to sign-in page by default', () => {
      render(
        <TestWrapper initialEntries={['/test']}>
          <Route path="/test" element={
            <ProtectedRoute>
              <TestComponent />
            </ProtectedRoute>
          } />
        </TestWrapper>
      );
      
      expect(screen.getByText('Sign In Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should redirect to custom path when specified', () => {
      render(
        <TestWrapper initialEntries={['/test']}>
          <Route path="/test" element={
            <ProtectedRoute redirectTo="/custom-login">
              <TestComponent />
            </ProtectedRoute>
          } />
        </TestWrapper>
      );
      
      expect(screen.getByText('Custom Login')).toBeInTheDocument();
    });

    it('should render content when requireAuth is false', () => {
      render(
        <TestWrapper initialEntries={['/test']}>
          <Route path="/test" element={
            <ProtectedRoute requireAuth={false}>
              <TestComponent />
            </ProtectedRoute>
          } />
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('when authentication is loading', () => {
    beforeEach(() => {
      mockAuthContext.isLoading = true;
    });

    it('should show loading state', () => {
      render(
        <TestWrapper initialEntries={['/test']}>
          <Route path="/test" element={
            <ProtectedRoute>
              <TestComponent />
            </ProtectedRoute>
          } />
        </TestWrapper>
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });
});

describe('PublicOnlyRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.user = null;
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.isLoading = false;
  });

  describe('when user is not authenticated', () => {
    it('should render public content', () => {
      render(
        <TestWrapper initialEntries={['/test']}>
          <Route path="/test" element={
            <PublicOnlyRoute>
              <PublicComponent />
            </PublicOnlyRoute>
          } />
        </TestWrapper>
      );
      
      expect(screen.getByText('Public Content')).toBeInTheDocument();
    });
  });

  describe('when user is authenticated', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      };
    });

    it('should redirect to home page by default', () => {
      render(
        <TestWrapper initialEntries={['/test']}>
          <Route path="/test" element={
            <PublicOnlyRoute>
              <PublicComponent />
            </PublicOnlyRoute>
          } />
        </TestWrapper>
      );
      
      expect(screen.getByText('Home Page')).toBeInTheDocument();
      expect(screen.queryByText('Public Content')).not.toBeInTheDocument();
    });

    it('should redirect to custom path when specified', () => {
      render(
        <TestWrapper initialEntries={['/test']}>
          <Route path="/test" element={
            <PublicOnlyRoute redirectTo="/dashboard">
              <PublicComponent />
            </PublicOnlyRoute>
          } />
        </TestWrapper>
      );
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  describe('when authentication is loading', () => {
    beforeEach(() => {
      mockAuthContext.isLoading = true;
    });

    it('should show loading state', () => {
      render(
        <TestWrapper initialEntries={['/test']}>
          <Route path="/test" element={
            <PublicOnlyRoute>
              <PublicComponent />
            </PublicOnlyRoute>
          } />
        </TestWrapper>
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Public Content')).not.toBeInTheDocument();
    });
  });
});

describe('withProtectedRoute HOC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.user = null;
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.isLoading = false;
  });

  it('should create a protected component', () => {
    const ProtectedTestComponent = withProtectedRoute(TestComponent);

    render(
      <TestWrapper initialEntries={['/test']}>
        <Route path="/test" element={<ProtectedTestComponent />} />
      </TestWrapper>
    );
    
    expect(screen.getByText('Sign In Page')).toBeInTheDocument();
  });

  it('should pass through props to wrapped component', () => {
    const PropsTestComponent: React.FC<{ testProp: string }> = ({ testProp }) => (
      <div>{testProp}</div>
    );
    
    const ProtectedPropsComponent = withProtectedRoute(PropsTestComponent);

    mockAuthContext.isAuthenticated = true;
    mockAuthContext.user = {
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
    };

    render(
      <TestWrapper initialEntries={['/test']}>
        <Route path="/test" element={<ProtectedPropsComponent testProp="Hello World" />} />
      </TestWrapper>
    );
    
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should accept protection options', () => {
    const ProtectedTestComponent = withProtectedRoute(TestComponent, {
      redirectTo: '/custom-login',
      requireAuth: false,
    });

    render(
      <TestWrapper initialEntries={['/test']}>
        <Route path="/test" element={<ProtectedTestComponent />} />
      </TestWrapper>
    );
    
    // Should render content since requireAuth is false
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});