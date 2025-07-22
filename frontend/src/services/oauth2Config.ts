import { OAuth2Config } from '../contexts/AuthContext';

// OAuth2 configuration
export const oauth2Config: OAuth2Config = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/auth/callback/google`,
    scope: [
      'openid',
      'profile',
      'email'
    ]
  },
  github: {
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/auth/callback/github`,
    scope: [
      'user:email',
      'read:user'
    ]
  }
};

// OAuth2 provider URLs
export const OAUTH2_URLS = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token'
  },
  github: {
    authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token'
  }
} as const;

// OAuth2 utility functions
export class OAuth2Utils {
  /**
   * Generate a random state parameter for OAuth2 security
   */
  static generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Store OAuth2 state in session storage for verification
   */
  static storeState(state: string): void {
    sessionStorage.setItem('oauth2_state', state);
  }

  /**
   * Verify OAuth2 state parameter
   */
  static verifyState(receivedState: string): boolean {
    const storedState = sessionStorage.getItem('oauth2_state');
    sessionStorage.removeItem('oauth2_state'); // Clean up after verification
    return storedState === receivedState;
  }

  /**
   * Build OAuth2 authorization URL
   */
  static buildAuthorizationUrl(provider: 'google' | 'github'): string {
    const config = oauth2Config[provider];
    const providerUrls = OAUTH2_URLS[provider];
    const state = this.generateState();
    
    this.storeState(state);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope.join(' '),
      response_type: 'code',
      state: state,
    });

    // Add provider-specific parameters
    if (provider === 'google') {
      params.append('access_type', 'offline');
      params.append('prompt', 'consent');
    }

    return `${providerUrls.authorize}?${params.toString()}`;
  }

  /**
   * Parse OAuth2 callback URL parameters
   */
  static parseCallbackUrl(url: string): {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  } {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    return {
      code: params.get('code') || undefined,
      state: params.get('state') || undefined,
      error: params.get('error') || undefined,
      error_description: params.get('error_description') || undefined,
    };
  }

  /**
   * Validate OAuth2 configuration
   */
  static validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!oauth2Config.google.clientId) {
      errors.push('Google OAuth2 client ID is not configured');
    }

    if (!oauth2Config.github.clientId) {
      errors.push('GitHub OAuth2 client ID is not configured');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export configuration and utilities
export { oauth2Config as default };