// Token storage keys
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const TOKEN_EXPIRY_KEY = 'auth_token_expiry';

// Types for token refresh
interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type TokenRefreshCallback = () => Promise<TokenRefreshResponse>;

// Token management utility class
export class TokenManager {
  private static refreshCallback: TokenRefreshCallback | null = null;
  private static refreshPromise: Promise<TokenRefreshResponse> | null = null;
  /**
   * Get the stored access token
   */
  static getAccessToken(): string | null {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  /**
   * Get the stored refresh token
   */
  static getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  /**
   * Store authentication tokens securely
   */
  static setTokens(accessToken: string, refreshToken: string, expiresIn?: number): void {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      
      if (expiresIn) {
        const expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      }
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * Clear all stored authentication tokens
   */
  static clearTokens(): void {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  /**
   * Check if the access token is expired
   */
  static isTokenExpired(): boolean {
    try {
      const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (!expiryTime) {
        return true; // If no expiry time is set, consider token expired
      }
      
      const expiry = parseInt(expiryTime, 10);
      const now = Date.now();
      
      // Add 5 minute buffer to refresh token before actual expiry
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      return now >= (expiry - bufferTime);
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true; // If error occurs, consider token expired for safety
    }
  }

  /**
   * Check if user has valid authentication tokens
   */
  static hasValidTokens(): boolean {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    
    return !!(accessToken && refreshToken && !this.isTokenExpired());
  }

  /**
   * Get token expiry time as Date object
   */
  static getTokenExpiry(): Date | null {
    try {
      const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (!expiryTime) {
        return null;
      }
      
      return new Date(parseInt(expiryTime, 10));
    } catch (error) {
      console.error('Error getting token expiry:', error);
      return null;
    }
  }

  /**
   * Check if refresh token exists (for determining if refresh is possible)
   */
  static canRefreshToken(): boolean {
    return !!this.getRefreshToken();
  }

  /**
   * Decode JWT token payload (basic implementation without verification)
   * Note: This is for client-side convenience only, server should always verify tokens
   */
  static decodeTokenPayload(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token payload:', error);
      return null;
    }
  }

  /**
   * Get user ID from access token (if available)
   */
  static getUserIdFromToken(): string | null {
    const token = this.getAccessToken();
    if (!token) return null;
    
    const payload = this.decodeTokenPayload(token);
    return payload?.sub || payload?.userId || null;
  }

  /**
   * Set the callback function for token refresh
   */
  static setRefreshCallback(callback: TokenRefreshCallback): void {
    this.refreshCallback = callback;
  }

  /**
   * Get a valid access token, automatically refreshing if needed
   */
  static async getValidAccessToken(): Promise<string | null> {
    const accessToken = this.getAccessToken();
    
    // If no access token exists, return null
    if (!accessToken) {
      return null;
    }

    // If token is not expired, return it
    if (!this.isTokenExpired()) {
      return accessToken;
    }

    // If token is expired, try to refresh it
    try {
      await this.refreshTokenIfNeeded();
      return this.getAccessToken();
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }

  /**
   * Refresh token if needed (with deduplication)
   */
  static async refreshTokenIfNeeded(): Promise<void> {
    // If token is not expired, no need to refresh
    if (!this.isTokenExpired()) {
      return;
    }

    // If no refresh callback is set, throw error
    if (!this.refreshCallback) {
      throw new Error('No refresh callback set. Call setRefreshCallback() first.');
    }

    // If no refresh token exists, throw error
    if (!this.canRefreshToken()) {
      throw new Error('No refresh token available');
    }

    // If refresh is already in progress, wait for it
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    // Start refresh process
    this.refreshPromise = this.performTokenRefresh();

    try {
      await this.refreshPromise;
    } finally {
      // Clear the promise when done (success or failure)
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private static async performTokenRefresh(): Promise<TokenRefreshResponse> {
    if (!this.refreshCallback) {
      throw new Error('No refresh callback available');
    }

    try {
      const response = await this.refreshCallback();
      
      // Update stored tokens
      this.setTokens(response.accessToken, response.refreshToken, response.expiresIn);
      
      return response;
    } catch (error) {
      // Clear tokens if refresh fails
      this.clearTokens();
      throw error;
    }
  }

  /**
   * Check if token needs refresh (within buffer time)
   */
  static needsRefresh(): boolean {
    return this.isTokenExpired() && this.canRefreshToken();
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  static getTimeUntilExpiry(): number | null {
    const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiryTime) {
      return null;
    }

    const expiry = parseInt(expiryTime, 10);
    const now = Date.now();
    
    return Math.max(0, expiry - now);
  }

  /**
   * Schedule automatic token refresh
   */
  static scheduleTokenRefresh(): void {
    const timeUntilExpiry = this.getTimeUntilExpiry();
    
    if (!timeUntilExpiry || !this.canRefreshToken()) {
      return;
    }

    // Schedule refresh 5 minutes before expiry
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    const refreshTime = Math.max(0, timeUntilExpiry - bufferTime);

    setTimeout(async () => {
      try {
        await this.refreshTokenIfNeeded();
        // Schedule next refresh after successful refresh
        this.scheduleTokenRefresh();
      } catch (error) {
        console.error('Scheduled token refresh failed:', error);
      }
    }, refreshTime);
  }

  /**
   * Validate token format (basic JWT structure check)
   */
  static isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // JWT should have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Each part should be base64url encoded
    try {
      for (const part of parts) {
        if (!part) return false;
        // Try to decode each part
        atob(part.replace(/-/g, '+').replace(/_/g, '/'));
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get token information for debugging
   */
  static getTokenInfo(): {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    isExpired: boolean;
    expiryTime: Date | null;
    timeUntilExpiry: number | null;
    canRefresh: boolean;
  } {
    return {
      hasAccessToken: !!this.getAccessToken(),
      hasRefreshToken: !!this.getRefreshToken(),
      isExpired: this.isTokenExpired(),
      expiryTime: this.getTokenExpiry(),
      timeUntilExpiry: this.getTimeUntilExpiry(),
      canRefresh: this.canRefreshToken(),
    };
  }
}

// Export utility functions for convenience
export const {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isTokenExpired,
  hasValidTokens,
  canRefreshToken,
  getUserIdFromToken,
  getValidAccessToken,
  refreshTokenIfNeeded,
  needsRefresh,
  getTimeUntilExpiry,
  scheduleTokenRefresh,
  isValidTokenFormat,
  getTokenInfo,
  setRefreshCallback
} = TokenManager;

// Export types
export type { TokenRefreshCallback, TokenRefreshResponse };