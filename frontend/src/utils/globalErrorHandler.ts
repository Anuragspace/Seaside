import { ErrorService } from '../services/errorService';

/**
 * Setup global error handlers for uncaught exceptions and unhandled promise rejections
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message);
    
    ErrorService.processError(error, {
      action: 'uncaught_exception',
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
    
    // Don't prevent default behavior - let browser console still show the error
    return false;
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    let error: Error;
    
    if (event.reason instanceof Error) {
      error = event.reason;
    } else if (typeof event.reason === 'string') {
      error = new Error(event.reason);
    } else {
      try {
        error = new Error(JSON.stringify(event.reason));
      } catch {
        error = new Error('Unknown promise rejection');
      }
    }
    
    ErrorService.processError(error, {
      action: 'unhandled_rejection',
    });
    
    // Don't prevent default behavior - let browser console still show the error
    return false;
  });
  
  // Log initialization
  if (import.meta.env.DEV) {
    console.info('Global error handlers initialized');
  }
}

export default setupGlobalErrorHandlers;