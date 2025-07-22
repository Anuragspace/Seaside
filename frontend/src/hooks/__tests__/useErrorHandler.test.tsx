import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useErrorHandler } from '../useErrorHandler';
import { AuthError } from '../../services/authService';
import { ErrorService } from '../../services/errorService';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

// Mock dependencies
vi.mock('../../contexts/NotificationContext');
vi.mock('../../contexts/AuthContext');
vi.mock('../../services/errorService');

// Test component that uses the hook
const TestComponent = ({ onHookResult }: { onHookResult: (result: any) => void }) => {
  const errorHandler = useErrorHandler();
  
  React.useEffect(() => {
    onHookResult(errorHandler);
  }, [errorHandler, onHookResult]);
  
  return <div>Test Component</div>;
};

describe('useErrorHandler', () => {
  const mockShowError = vi.fn();
  const mockSignOut = vi.fn();
  const mockProcessError = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useNotifications hook
    (useNotifications as any).mockReturnValue({
      showError: mockShowError,
    });
    
    // Mock useAuth hook
    (useAuth as any).mockReturnValue({
      signOut: mockSignOut,
    });
    
    // Mock ErrorService
    (ErrorService.processError as any) = mockProcessError;
  });

  it('handleError calls showError with the error', () => {
    let hookResult: any;
    render(<TestComponent onHookResult={(result) => { hookResult = result; }} />);
    
    const error = new Error('Test error');
    const context = { action: 'test' };
    
    hookResult.handleError(error, context);
    
    expect(mockShowError).toHaveBeenCalledWith(error, context);
    expect(mockProcessError).toHaveBeenCalled();
  });

  it('handleAuthError calls signOut for 401 errors', () => {
    let hookResult: any;
    render(<TestComponent onHookResult={(result) => { hookResult = result; }} />);
    
    const error = new AuthError('Unauthorized', 401);
    
    hookResult.handleAuthError(error);
    
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith(error, expect.anything());
  });

  it('handleAuthError does not call signOut for non-401 errors', () => {
    let hookResult: any;
    render(<TestComponent onHookResult={(result) => { hookResult = result; }} />);
    
    const error = new AuthError('Bad Request', 400);
    
    hookResult.handleAuthError(error);
    
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith(error, expect.anything());
  });

  it('handleNetworkError processes error with network category', () => {
    let hookResult: any;
    render(<TestComponent onHookResult={(result) => { hookResult = result; }} />);
    
    const error = new Error('Network error');
    
    hookResult.handleNetworkError(error);
    
    expect(mockProcessError).toHaveBeenCalledWith(error, expect.objectContaining({
      category: 'network',
    }));
    expect(mockShowError).toHaveBeenCalledWith(error, expect.anything());
  });

  it('handleValidationError processes error with validation category', () => {
    let hookResult: any;
    render(<TestComponent onHookResult={(result) => { hookResult = result; }} />);
    
    const error = new Error('Validation error');
    
    hookResult.handleValidationError(error);
    
    expect(mockProcessError).toHaveBeenCalledWith(error, expect.objectContaining({
      category: 'validation',
    }));
    expect(mockShowError).toHaveBeenCalledWith(error, expect.anything());
  });

  it('handleError routes AuthError to handleAuthError', () => {
    let hookResult: any;
    render(<TestComponent onHookResult={(result) => { hookResult = result; }} />);
    
    const spy = vi.spyOn(hookResult, 'handleAuthError');
    const error = new AuthError('Auth error');
    
    hookResult.handleError(error);
    
    expect(spy).toHaveBeenCalledWith(error, undefined);
  });

  it('handleError routes network errors to handleNetworkError', () => {
    let hookResult: any;
    render(<TestComponent onHookResult={(result) => { hookResult = result; }} />);
    
    const spy = vi.spyOn(hookResult, 'handleNetworkError');
    const error = new Error('Network error occurred');
    
    hookResult.handleError(error);
    
    expect(spy).toHaveBeenCalledWith(error, undefined);
  });
});