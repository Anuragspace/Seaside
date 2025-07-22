import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';
import { AuthError } from '../../services/authService';

// Mock component that throws an error
const ErrorThrowingComponent = ({ shouldThrow = true, error = new Error('Test error') }) => {
  if (shouldThrow) {
    throw error;
  }
  return <div>No error</div>;
};

// Reset console.error to prevent test output noise
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders error UI when child component throws error', () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred/i)).toBeInTheDocument();
  });

  it('renders custom fallback UI when provided', () => {
    const fallback = <div data-testid="fallback">Custom fallback</div>;
    
    render(
      <ErrorBoundary fallback={fallback}>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('renders auth error UI for AuthError', () => {
    const authError = new AuthError('Authentication failed', 401, 'TOKEN_EXPIRED');
    
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent error={authError} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Authentication Error')).toBeInTheDocument();
    expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    expect(screen.getByText('Session Expired')).toBeInTheDocument();
  });

  it('calls onError prop when error occurs', () => {
    const onError = vi.fn();
    const error = new Error('Test error');
    
    render(
      <ErrorBoundary onError={onError}>
        <ErrorThrowingComponent error={error} />
      </ErrorBoundary>
    );
    
    expect(onError).toHaveBeenCalledWith(error, expect.anything());
  });

  it('renders network error UI for network AuthError', () => {
    const networkError = new AuthError('Network error occurred', 0, 'NETWORK_ERROR');
    
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent error={networkError} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Authentication Error')).toBeInTheDocument();
    expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    expect(screen.getByText('Connection Issue')).toBeInTheDocument();
  });
});