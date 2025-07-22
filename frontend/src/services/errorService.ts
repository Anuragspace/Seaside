import { AuthError } from './authService';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error categories
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  VALIDATION = 'validation',
  OAUTH2 = 'oauth2',
  PERMISSION = 'permission',
  SYSTEM = 'system',
  USER_INPUT = 'user_input',
}

// Error context interface
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  feature?: string;
  action?: string;
  source?: string;
  line?: number;
  column?: number;
  metadata?: Record<string, any>;
}

// Error log entry interface
export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code?: string;
  statusCode?: number;
  stack?: string;
  context?: ErrorContext;
  userAgent: string;
  url: string;
  resolved?: boolean;
}

// Error recovery action interface
export interface ErrorRecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

// User-friendly error message mapping
const ERROR_MESSAGES: Record<string, { message: string; category: ErrorCategory; severity: ErrorSeverity; recoveryActions?: ErrorRecoveryAction[] }> = {
  // Authentication errors
  'INVALID_CREDENTIALS': {
    message: 'Invalid email or password. Please check your credentials and try again.',
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.MEDIUM,
  },
  'USER_NOT_FOUND': {
    message: 'No account found with this email address.',
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.MEDIUM,
  },
  'EMAIL_ALREADY_EXISTS': {
    message: 'An account with this email already exists. Please sign in instead.',
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.MEDIUM,
  },
  'WEAK_PASSWORD': {
    message: 'Password is too weak. Please choose a stronger password.',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.MEDIUM,
  },
  'NO_REFRESH_TOKEN': {
    message: 'Your session has expired. Please sign in again.',
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.HIGH,
  },
  'TOKEN_EXPIRED': {
    message: 'Your session has expired. Please sign in again.',
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.HIGH,
  },
  
  // OAuth2 errors
  'OAUTH2_ACCESS_DENIED': {
    message: 'Access was denied. Please try signing in again.',
    category: ErrorCategory.OAUTH2,
    severity: ErrorSeverity.MEDIUM,
  },
  'OAUTH2_INVALID_REQUEST': {
    message: 'Invalid OAuth2 request. Please try again.',
    category: ErrorCategory.OAUTH2,
    severity: ErrorSeverity.HIGH,
  },
  'OAUTH2_SERVER_ERROR': {
    message: 'OAuth2 provider error. Please try again later.',
    category: ErrorCategory.OAUTH2,
    severity: ErrorSeverity.HIGH,
  },
  'INVALID_STATE': {
    message: 'Security validation failed. Please try signing in again.',
    category: ErrorCategory.OAUTH2,
    severity: ErrorSeverity.HIGH,
  },
  
  // Network errors
  'NETWORK_ERROR': {
    message: 'Network connection failed. Please check your internet connection.',
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
  },
  'SERVER_ERROR': {
    message: 'Server error occurred. Please try again later.',
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
  },
  'TIMEOUT_ERROR': {
    message: 'Request timed out. Please try again.',
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
  },
  
  // File upload errors
  'INVALID_FILE_TYPE': {
    message: 'Invalid file type. Please select a valid image file.',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.MEDIUM,
  },
  'FILE_TOO_LARGE': {
    message: 'File is too large. Please select a smaller file.',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.MEDIUM,
  },
  
  // Permission errors
  'INSUFFICIENT_PERMISSIONS': {
    message: 'You do not have permission to perform this action.',
    category: ErrorCategory.PERMISSION,
    severity: ErrorSeverity.MEDIUM,
  },
  'RECORDING_REQUIRES_AUTH': {
    message: 'Recording features require authentication. Please sign in to continue.',
    category: ErrorCategory.PERMISSION,
    severity: ErrorSeverity.MEDIUM,
  },
};

/**
 * Error service for centralized error handling, logging, and user feedback
 */
export class ErrorService {
  private static errorLog: ErrorLogEntry[] = [];
  private static maxLogSize = 100;

  /**
   * Process and log an error
   */
  static processError(
    error: Error | AuthError,
    context?: ErrorContext
  ): ErrorLogEntry {
    const errorEntry = this.createErrorLogEntry(error, context);
    
    // Add to error log
    this.addToErrorLog(errorEntry);
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error processed:', errorEntry);
    }
    
    // Send to monitoring service in production
    if (import.meta.env.PROD) {
      this.sendToMonitoring(errorEntry);
    }
    
    return errorEntry;
  }

  /**
   * Get user-friendly error message and recovery actions
   */
  static getUserFriendlyError(error: Error | AuthError): {
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    recoveryActions?: ErrorRecoveryAction[];
  } {
    let errorCode: string | undefined;
    
    if (error instanceof AuthError && error.code) {
      errorCode = error.code;
    } else if (error.message.includes('Network')) {
      errorCode = 'NETWORK_ERROR';
    } else if (error.message.includes('timeout')) {
      errorCode = 'TIMEOUT_ERROR';
    }
    
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      return ERROR_MESSAGES[errorCode];
    }
    
    // Default error message
    return {
      message: error.message || 'An unexpected error occurred. Please try again.',
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.MEDIUM,
    };
  }

  /**
   * Get recovery actions for specific error types
   */
  static getRecoveryActions(error: Error | AuthError): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];
    
    if (error instanceof AuthError) {
      switch (error.code) {
        case 'NO_REFRESH_TOKEN':
        case 'TOKEN_EXPIRED':
          actions.push({
            label: 'Sign In',
            action: () => { window.location.href = '/sign-in'; },
            primary: true,
          });
          break;
          
        case 'NETWORK_ERROR':
          actions.push({
            label: 'Retry',
            action: () => window.location.reload(),
            primary: true,
          });
          break;
          
        case 'OAUTH2_ACCESS_DENIED':
        case 'INVALID_STATE':
          actions.push({
            label: 'Try Again',
            action: () => { window.location.href = '/sign-in'; },
            primary: true,
          });
          break;
      }
    }
    
    // Always provide a generic retry option
    if (actions.length === 0) {
      actions.push({
        label: 'Try Again',
        action: () => window.location.reload(),
      });
    }
    
    return actions;
  }

  /**
   * Create error log entry
   */
  private static createErrorLogEntry(
    error: Error | AuthError,
    context?: ErrorContext
  ): ErrorLogEntry {
    const userFriendlyError = this.getUserFriendlyError(error);
    
    return {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      message: error.message,
      category: userFriendlyError.category,
      severity: userFriendlyError.severity,
      code: error instanceof AuthError ? error.code : undefined,
      statusCode: error instanceof AuthError ? error.statusCode : undefined,
      stack: error.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      resolved: false,
    };
  }

  /**
   * Add error to local log
   */
  private static addToErrorLog(errorEntry: ErrorLogEntry): void {
    this.errorLog.unshift(errorEntry);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
  }

  /**
   * Send error to monitoring service
   */
  private static sendToMonitoring(errorEntry: ErrorLogEntry): void {
    // This would integrate with your error monitoring service
    // Examples: Sentry, LogRocket, Bugsnag, etc.
    
    try {
      // Example integration:
      // window.Sentry?.captureException(new Error(errorEntry.message), {
      //   tags: {
      //     category: errorEntry.category,
      //     severity: errorEntry.severity,
      //   },
      //   extra: errorEntry,
      // });
      
      // For now, just log to console in production
      console.error('Production error logged:', {
        id: errorEntry.id,
        message: errorEntry.message,
        category: errorEntry.category,
        severity: errorEntry.severity,
        timestamp: errorEntry.timestamp,
      });
    } catch (monitoringError) {
      console.error('Failed to send error to monitoring service:', monitoringError);
    }
  }

  /**
   * Generate unique error ID
   */
  private static generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get error log (for debugging)
   */
  static getErrorLog(): ErrorLogEntry[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  static clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Mark error as resolved
   */
  static markErrorAsResolved(errorId: string): void {
    const error = this.errorLog.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
    }
  }

  /**
   * Get unresolved errors
   */
  static getUnresolvedErrors(): ErrorLogEntry[] {
    return this.errorLog.filter(error => !error.resolved);
  }

  /**
   * Get errors by category
   */
  static getErrorsByCategory(category: ErrorCategory): ErrorLogEntry[] {
    return this.errorLog.filter(error => error.category === category);
  }

  /**
   * Get errors by severity
   */
  static getErrorsBySeverity(severity: ErrorSeverity): ErrorLogEntry[] {
    return this.errorLog.filter(error => error.severity === severity);
  }
}

export default ErrorService;