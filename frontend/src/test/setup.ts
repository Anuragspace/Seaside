import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';
import React from 'react';

// Mock environment variables
vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');
vi.stubEnv('VITE_GITHUB_CLIENT_ID', 'test-github-client-id');

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000',
  },
  writable: true,
});

// Mock crypto.getRandomValues for OAuth2 state generation
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock fetch
global.fetch = vi.fn();

// Mock NextUI components
vi.mock('@nextui-org/react', async () => {
  const actual = await vi.importActual('@nextui-org/react');
  return {
    ...actual,
    Card: ({ children, className, ...props }: any) => React.createElement('div', { className, ...props }, children),
    CardHeader: ({ children, className, ...props }: any) => React.createElement('div', { className, ...props }, children),
    CardBody: ({ children, className, ...props }: any) => React.createElement('div', { className, ...props }, children),
    CardFooter: ({ children, className, ...props }: any) => React.createElement('div', { className, ...props }, children),
    Input: ({ children, className, errorMessage, isInvalid, startContent, endContent, ...props }: any) => 
      React.createElement('div', { className }, 
        startContent,
        React.createElement('input', props),
        endContent,
        isInvalid && errorMessage && React.createElement('span', { role: 'alert' }, errorMessage),
        children
      ),
    Button: ({ children, className, isLoading, onPress, ...props }: any) => 
      React.createElement('button', { 
        className, 
        onClick: onPress, 
        disabled: isLoading,
        ...props
      }, isLoading ? 'Loading...' : children),
    Divider: ({ className, ...props }: any) => React.createElement('hr', { className, ...props }),
  };
});

// Mock NotificationProvider for tests that need it
vi.mock('../contexts/NotificationContext', async () => {
  const actual = await vi.importActual('../contexts/NotificationContext');
  return {
    ...actual,
    NotificationProvider: ({ children }: { children: React.ReactNode }) => children,
    useNotifications: () => ({
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
      showWarning: vi.fn(),
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  };
});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
});