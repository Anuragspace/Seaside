import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupGlobalErrorHandlers } from '../globalErrorHandler';
import { ErrorService } from '../../services/errorService';

// Mock ErrorService
vi.mock('../../services/errorService', () => ({
  ErrorService: {
    processError: vi.fn(),
  },
}));

describe('globalErrorHandler', () => {
  // Save original addEventListener
  const originalAddEventListener = window.addEventListener;
  const mockAddEventListener = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    window.addEventListener = mockAddEventListener;
    console.info = vi.fn();
  });
  
  afterEach(() => {
    window.addEventListener = originalAddEventListener;
  });
  
  it('sets up event listeners for error and unhandledrejection', () => {
    setupGlobalErrorHandlers();
    
    expect(mockAddEventListener).toHaveBeenCalledTimes(2);
    expect(mockAddEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });
  
  it('logs initialization message', () => {
    setupGlobalErrorHandlers();
    
    expect(console.info).toHaveBeenCalledWith('Global error handlers initialized');
  });
  
  it('error handler processes uncaught exceptions', () => {
    // Setup
    setupGlobalErrorHandlers();
    const errorHandler = mockAddEventListener.mock.calls.find((call: any) => call[0] === 'error')[1];
    
    // Create mock error event
    const mockErrorEvent = {
      error: new Error('Test error'),
      message: 'Test error message',
      filename: 'test.js',
      lineno: 42,
      colno: 10,
      preventDefault: vi.fn(),
    };
    
    // Trigger error handler
    errorHandler(mockErrorEvent);
    
    // Verify error was processed
    expect(ErrorService.processError).toHaveBeenCalledWith(
      mockErrorEvent.error,
      expect.objectContaining({
        action: 'uncaught_exception',
        source: mockErrorEvent.filename,
        line: mockErrorEvent.lineno,
        column: mockErrorEvent.colno,
      })
    );
  });
  
  it('unhandledrejection handler processes promise rejections with Error objects', () => {
    // Setup
    setupGlobalErrorHandlers();
    const rejectionHandler = mockAddEventListener.mock.calls.find(
      (call: any) => call[0] === 'unhandledrejection'
    )[1];
    
    // Create mock rejection event with Error reason
    const error = new Error('Promise rejection');
    const mockRejectionEvent = {
      reason: error,
      preventDefault: vi.fn(),
    };
    
    // Trigger rejection handler
    rejectionHandler(mockRejectionEvent);
    
    // Verify error was processed
    expect(ErrorService.processError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        action: 'unhandled_rejection',
      })
    );
  });
  
  it('unhandledrejection handler processes promise rejections with string reasons', () => {
    // Setup
    setupGlobalErrorHandlers();
    const rejectionHandler = mockAddEventListener.mock.calls.find(
      (call: any) => call[0] === 'unhandledrejection'
    )[1];
    
    // Create mock rejection event with string reason
    const mockRejectionEvent = {
      reason: 'String rejection reason',
      preventDefault: vi.fn(),
    };
    
    // Trigger rejection handler
    rejectionHandler(mockRejectionEvent);
    
    // Verify error was processed with string converted to Error
    expect(ErrorService.processError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'String rejection reason',
      }),
      expect.objectContaining({
        action: 'unhandled_rejection',
      })
    );
  });
});