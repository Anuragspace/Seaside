import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the oauth2Config module to use test values
vi.mock('../oauth2Config', async () => {
  const actual = await vi.importActual('../oauth2Config');
  return {
    ...actual,
    oauth2Config: {
      google: {
        clientId: 'test-google-client-id',
        redirectUri: 'http://localhost:3000/auth/callback/google',
        scope: ['openid', 'profile', 'email']
      },
      github: {
        clientId: 'test-github-client-id',
        redirectUri: 'http://localhost:3000/auth/callback/github',
        scope: ['user:email', 'read:user']
      }
    }
  };
});

import { OAuth2Utils, oauth2Config, OAUTH2_URLS } from '../oauth2Config';

describe('OAuth2Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    // Mock crypto.getRandomValues
    Object.defineProperty(global, 'crypto', {
      value: {
        getRandomValues: vi.fn((arr: Uint8Array) => {
          // Fill with predictable values for testing
          for (let i = 0; i < arr.length; i++) {
            arr[i] = i % 256;
          }
          return arr;
        }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('oauth2Config', () => {
    it('should have correct configuration structure', () => {
      expect(oauth2Config).toHaveProperty('google');
      expect(oauth2Config).toHaveProperty('github');

      expect(oauth2Config.google).toHaveProperty('clientId');
      expect(oauth2Config.google).toHaveProperty('redirectUri');
      expect(oauth2Config.google).toHaveProperty('scope');

      expect(oauth2Config.github).toHaveProperty('clientId');
      expect(oauth2Config.github).toHaveProperty('redirectUri');
      expect(oauth2Config.github).toHaveProperty('scope');
    });

    it('should have correct redirect URIs', () => {
      expect(oauth2Config.google.redirectUri).toBe('http://localhost:3000/auth/callback/google');
      expect(oauth2Config.github.redirectUri).toBe('http://localhost:3000/auth/callback/github');
    });

    it('should have correct scopes', () => {
      expect(oauth2Config.google.scope).toEqual(['openid', 'profile', 'email']);
      expect(oauth2Config.github.scope).toEqual(['user:email', 'read:user']);
    });
  });

  describe('OAUTH2_URLS', () => {
    it('should have correct provider URLs', () => {
      expect(OAUTH2_URLS.google.authorize).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(OAUTH2_URLS.google.token).toBe('https://oauth2.googleapis.com/token');

      expect(OAUTH2_URLS.github.authorize).toBe('https://github.com/login/oauth/authorize');
      expect(OAUTH2_URLS.github.token).toBe('https://github.com/login/oauth/access_token');
    });
  });

  describe('OAuth2Utils', () => {
    describe('generateState', () => {
      it('should generate a random state string', () => {
        const state = OAuth2Utils.generateState();
        
        expect(typeof state).toBe('string');
        expect(state.length).toBe(64); // 32 bytes * 2 hex chars per byte
        expect(state).toMatch(/^[0-9a-f]+$/); // Only hex characters
      });

      it('should generate different states on multiple calls', () => {
        // Mock crypto to return different values
        let callCount = 0;
        vi.mocked(global.crypto.getRandomValues).mockImplementation((arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = (i + callCount) % 256;
          }
          callCount++;
          return arr;
        });

        const state1 = OAuth2Utils.generateState();
        const state2 = OAuth2Utils.generateState();
        
        expect(state1).not.toBe(state2);
      });
    });

    describe('storeState and verifyState', () => {
      it('should store and verify state correctly', () => {
        const testState = 'test-state-123';
        
        OAuth2Utils.storeState(testState);
        
        expect(window.sessionStorage.setItem).toHaveBeenCalledWith('oauth2_state', testState);
      });

      it('should verify stored state correctly', () => {
        const testState = 'test-state-123';
        
        vi.mocked(window.sessionStorage.getItem).mockReturnValue(testState);
        
        const isValid = OAuth2Utils.verifyState(testState);
        
        expect(isValid).toBe(true);
        expect(window.sessionStorage.getItem).toHaveBeenCalledWith('oauth2_state');
        expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('oauth2_state');
      });

      it('should return false for invalid state', () => {
        const storedState = 'stored-state';
        const receivedState = 'different-state';
        
        vi.mocked(window.sessionStorage.getItem).mockReturnValue(storedState);
        
        const isValid = OAuth2Utils.verifyState(receivedState);
        
        expect(isValid).toBe(false);
        expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('oauth2_state');
      });

      it('should return false when no state is stored', () => {
        vi.mocked(window.sessionStorage.getItem).mockReturnValue(null);
        
        const isValid = OAuth2Utils.verifyState('any-state');
        
        expect(isValid).toBe(false);
      });
    });

    describe('buildAuthorizationUrl', () => {
      it('should build correct Google authorization URL', () => {
        vi.spyOn(OAuth2Utils, 'generateState').mockReturnValue('mock-state');
        vi.spyOn(OAuth2Utils, 'storeState').mockImplementation(() => {});

        const url = OAuth2Utils.buildAuthorizationUrl('google');
        
        expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
        expect(url).toContain('client_id=test-google-client-id');
        expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback%2Fgoogle');
        expect(url).toContain('scope=openid+profile+email');
        expect(url).toContain('response_type=code');
        expect(url).toContain('state=mock-state');
        expect(url).toContain('access_type=offline');
        expect(url).toContain('prompt=consent');
        
        expect(OAuth2Utils.storeState).toHaveBeenCalledWith('mock-state');
      });

      it('should build correct GitHub authorization URL', () => {
        vi.spyOn(OAuth2Utils, 'generateState').mockReturnValue('mock-state');
        vi.spyOn(OAuth2Utils, 'storeState').mockImplementation(() => {});

        const url = OAuth2Utils.buildAuthorizationUrl('github');
        
        expect(url).toContain('https://github.com/login/oauth/authorize');
        expect(url).toContain('client_id=test-github-client-id');
        expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback%2Fgithub');
        expect(url).toContain('scope=user%3Aemail+read%3Auser');
        expect(url).toContain('response_type=code');
        expect(url).toContain('state=mock-state');
        
        // GitHub-specific parameters should not be present
        expect(url).not.toContain('access_type=offline');
        expect(url).not.toContain('prompt=consent');
      });
    });

    describe('parseCallbackUrl', () => {
      it('should parse successful callback URL', () => {
        const url = 'http://localhost:3000/auth/callback/google?code=auth-code-123&state=state-456';
        
        const params = OAuth2Utils.parseCallbackUrl(url);
        
        expect(params).toEqual({
          code: 'auth-code-123',
          state: 'state-456',
          error: undefined,
          error_description: undefined,
        });
      });

      it('should parse error callback URL', () => {
        const url = 'http://localhost:3000/auth/callback/google?error=access_denied&error_description=User%20denied%20access';
        
        const params = OAuth2Utils.parseCallbackUrl(url);
        
        expect(params).toEqual({
          code: undefined,
          state: undefined,
          error: 'access_denied',
          error_description: 'User denied access',
        });
      });

      it('should handle URL with no parameters', () => {
        const url = 'http://localhost:3000/auth/callback/google';
        
        const params = OAuth2Utils.parseCallbackUrl(url);
        
        expect(params).toEqual({
          code: undefined,
          state: undefined,
          error: undefined,
          error_description: undefined,
        });
      });
    });

    describe('validateConfig', () => {
      it('should return valid when all client IDs are configured', () => {
        const result = OAuth2Utils.validateConfig();
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should validate configuration structure', () => {
        // Test the validation logic by checking the function behavior
        const result = OAuth2Utils.validateConfig();
        
        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('errors');
        expect(Array.isArray(result.errors)).toBe(true);
      });
    });
  });
});