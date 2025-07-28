import { SignInData, SignUpData, AuthResponse, User } from '../contexts/AuthContext';
import { TokenManager } from '../utils/tokenManager';
import { OAuth2Utils } from './oauth2Config';

// Profile update data interface
export interface ProfileUpdateData {
  username?: string;
  email?: string;
}

// Avatar upload response interface
export interface AvatarUploadResponse {
  avatarUrl: string;
  user: User;
}

// API endpoints configuration
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

const API_ENDPOINTS = {
  login: `${API_BASE_URL}/auth/login`,
  register: `${API_BASE_URL}/auth/register`,
  refresh: `${API_BASE_URL}/auth/refresh`,
  logout: `${API_BASE_URL}/auth/logout`,
  me: `${API_BASE_URL}/api/me`,
  updateProfile: `${API_BASE_URL}/auth/profile`,
  uploadAvatar: `${API_BASE_URL}/auth/avatar`,
  removeAvatar: `${API_BASE_URL}/auth/avatar`,
  oauth: {
    google: `${API_BASE_URL}/auth/oauth/google`,
    github: `${API_BASE_URL}/auth/oauth/github`,
  }
} as const;

// Custom error class for authentication errors
class AuthError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// Authentication service class
export class AuthService {
  // Initialize the token refresh callback
  static {
    TokenManager.setRefreshCallback(async () => {
      const refreshToken = TokenManager.getRefreshToken();

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(API_ENDPOINTS.refresh, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Token refresh failed');
      }

      const data = await response.json();
      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
      };
    });
  }

  /**
   * Make authenticated API request with automatic token handling
   */
  private static async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Get valid access token (will refresh if needed)
    const accessToken = await TokenManager.getValidAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AuthError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.code
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      // Handle network errors
      throw new AuthError(
        'Network error occurred. Please check your connection.',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Sign in with email and password
   */
  static async signIn(credentials: SignInData): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest<AuthResponse>(
        API_ENDPOINTS.login,
        {
          method: 'POST',
          body: JSON.stringify(credentials),
        }
      );

      // Store tokens after successful authentication
      TokenManager.setTokens(
        response.accessToken,
        response.refreshToken,
        response.expiresIn
      );

      return response;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Sign in failed. Please try again.');
    }
  }

  /**
   * Sign up with user data
   */
  static async signUp(userData: SignUpData): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest<AuthResponse>(
        API_ENDPOINTS.register,
        {
          method: 'POST',
          body: JSON.stringify(userData),
        }
      );

      // Store tokens after successful registration
      console.log('Signup response before storing tokens:', response);
      TokenManager.setTokens(
        response.accessToken,
        response.refreshToken,
        response.expiresIn
      );
      console.log('Tokens stored, checking storage:', {
        accessToken: localStorage.getItem('auth_access_token'),
        refreshToken: localStorage.getItem('auth_refresh_token')
      });

      return response;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Sign up failed. Please try again.');
    }
  }

  /**
   * Sign in with OAuth2 provider
   */
  static async signInWithOAuth(
    provider: 'google' | 'github',
    code: string,
    state: string
  ): Promise<AuthResponse> {
    try {
      // Verify state parameter for security
      if (!OAuth2Utils.verifyState(state)) {
        throw new AuthError('Invalid OAuth2 state parameter', 400, 'INVALID_STATE');
      }

      const response = await this.makeRequest<AuthResponse>(
        API_ENDPOINTS.oauth[provider],
        {
          method: 'POST',
          body: JSON.stringify({ code, state }),
        }
      );

      // Store tokens after successful OAuth2 authentication
      TokenManager.setTokens(
        response.accessToken,
        response.refreshToken,
        response.expiresIn
      );

      return response;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(`${provider} authentication failed. Please try again.`);
    }
  }

  /**
   * Refresh authentication tokens
   */
  static async refreshToken(): Promise<AuthResponse> {
    const refreshToken = TokenManager.getRefreshToken();

    if (!refreshToken) {
      throw new AuthError('No refresh token available', 401, 'NO_REFRESH_TOKEN');
    }

    try {
      const response = await this.makeRequest<AuthResponse>(
        API_ENDPOINTS.refresh,
        {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        }
      );

      // Update stored tokens
      TokenManager.setTokens(
        response.accessToken,
        response.refreshToken,
        response.expiresIn
      );

      return response;
    } catch (error) {
      // Clear tokens if refresh fails
      TokenManager.clearTokens();

      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Token refresh failed. Please sign in again.');
    }
  }

  /**
   * Sign out user
   */
  static async signOut(): Promise<void> {
    const refreshToken = TokenManager.getRefreshToken();

    try {
      // Attempt to notify server about logout
      if (refreshToken) {
        await this.makeRequest(API_ENDPOINTS.logout, {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      // Continue with local cleanup even if server request fails
      console.warn('Server logout failed:', error);
    } finally {
      // Always clear local tokens
      TokenManager.clearTokens();
    }
  }

  /**
   * Get current user information
   */
  static async getCurrentUser(): Promise<User> {
    try {
      return await this.makeRequest<User>(API_ENDPOINTS.me);
    } catch (error) {
      if (error instanceof AuthError && error.statusCode === 401) {
        // Token might be expired, clear it
        TokenManager.clearTokens();
      }

      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Failed to get user information.');
    }
  }

  /**
   * Check if user is authenticated (has valid tokens)
   */
  static isAuthenticated(): boolean {
    return TokenManager.hasValidTokens();
  }

  /**
   * Initialize automatic token refresh scheduling
   */
  static initializeTokenRefresh(): void {
    // Schedule automatic token refresh if user is authenticated
    if (this.isAuthenticated()) {
      TokenManager.scheduleTokenRefresh();
    }
  }

  /**
   * Initialize OAuth2 flow by redirecting to provider
   */
  static initiateOAuth2Flow(provider: 'google' | 'github'): void {
    try {
      const authUrl = OAuth2Utils.buildAuthorizationUrl(provider);
      window.location.href = authUrl;
    } catch (error) {
      throw new AuthError(`Failed to initiate ${provider} authentication.`);
    }
  }

  /**
   * Handle OAuth2 callback
   */
  static async handleOAuth2Callback(
    provider: 'google' | 'github',
    callbackUrl: string
  ): Promise<AuthResponse> {
    const params = OAuth2Utils.parseCallbackUrl(callbackUrl);

    if (params.error) {
      throw new AuthError(
        params.error_description || `OAuth2 error: ${params.error}`,
        400,
        params.error
      );
    }

    if (!params.code || !params.state) {
      throw new AuthError('Missing authorization code or state parameter', 400, 'MISSING_PARAMS');
    }

    return this.signInWithOAuth(provider, params.code, params.state);
  }

  /**
   * Update user profile information
   */
  static async updateProfile(profileData: ProfileUpdateData): Promise<User> {
    try {
      return await this.makeRequest<User>(
        API_ENDPOINTS.updateProfile,
        {
          method: 'PUT',
          body: JSON.stringify(profileData),
        }
      );
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Failed to update profile. Please try again.');
    }
  }

  /**
   * Upload user avatar
   */
  static async uploadAvatar(avatarFile: File): Promise<AvatarUploadResponse> {
    try {
      // Validate file type
      if (!avatarFile.type.startsWith('image/')) {
        throw new AuthError('Please select an image file', 400, 'INVALID_FILE_TYPE');
      }

      // Validate file size (max 5MB)
      if (avatarFile.size > 5 * 1024 * 1024) {
        throw new AuthError('Image size must be less than 5MB', 400, 'FILE_TOO_LARGE');
      }

      const formData = new FormData();
      formData.append('avatar', avatarFile);

      // Get valid access token
      const accessToken = await TokenManager.getValidAccessToken();

      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_ENDPOINTS.uploadAvatar, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AuthError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.code
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Failed to upload avatar. Please try again.');
    }
  }

  /**
   * Remove user avatar
   */
  static async removeAvatar(): Promise<User> {
    try {
      return await this.makeRequest<User>(
        API_ENDPOINTS.removeAvatar,
        {
          method: 'DELETE',
        }
      );
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Failed to remove avatar. Please try again.');
    }
  }
}

// Export service and error class
export { AuthError };
export default AuthService;