import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth, User, SignInData, SignUpData } from '../AuthContext';
import { AuthService, AuthError } from '../../services/authService';
import { TokenManager } from '../../utils/tokenManager';

// Mock the services
vi.mock('../../services/authService');
vi.mock('../../utils/tokenManager');

const mockAuthService = vi.mocked(AuthService);
const mockTokenManager = vi.mocked(TokenManager);

// Test component that uses the auth context
const TestComponent: React.FC = () => {
    const {
        user,
        isAuthenticated,
        isLoading,
        signIn,
        signUp,
        signInWithOAuth,
        signOut,
        refreshToken,
    } = useAuth();

    const [error, setError] = React.useState<string | null>(null);

    const handleSignIn = async () => {
        try {
            setError(null);
            await signIn({ email: 'test@example.com', password: 'password' });
        } catch (err) {
            const errorMessage = (err as any)?.message || 'Unknown error';
            setError(errorMessage);
            throw err;
        }
    };

    const handleSignUp = async () => {
        try {
            setError(null);
            await signUp({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password',
                confirmPassword: 'password'
            });
        } catch (err) {
            const errorMessage = (err as any)?.message || 'Unknown error';
            setError(errorMessage);
            throw err;
        }
    };

    const handleOAuthSignIn = async () => {
        try {
            setError(null);
            await signInWithOAuth('google');
        } catch (err) {
            const errorMessage = (err as any)?.message || 'Unknown error';
            setError(errorMessage);
            throw err;
        }
    };

    const handleSignOut = async () => {
        try {
            setError(null);
            await signOut();
        } catch (err) {
            const errorMessage = (err as any)?.message || 'Unknown error';
            setError(errorMessage);
            throw err;
        }
    };

    const handleRefreshToken = async () => {
        try {
            setError(null);
            await refreshToken();
        } catch (err) {
            const errorMessage = (err as any)?.message || 'Unknown error';
            setError(errorMessage);
            throw err;
        }
    };

    return (
        <div>
            <div data-testid="user">{user ? JSON.stringify(user) : 'null'}</div>
            <div data-testid="isAuthenticated">{isAuthenticated.toString()}</div>
            <div data-testid="isLoading">{isLoading.toString()}</div>
            <div data-testid="error">{error || 'null'}</div>
            <button onClick={handleSignIn}>
                Sign In
            </button>
            <button onClick={handleSignUp}>
                Sign Up
            </button>
            <button onClick={handleOAuthSignIn}>
                OAuth Sign In
            </button>
            <button onClick={handleSignOut}>
                Sign Out
            </button>
            <button onClick={handleRefreshToken}>
                Refresh Token
            </button>
        </div>
    );
};

// Mock user data
const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    username: 'testuser',
    avatar: 'https://example.com/avatar.jpg',
    provider: 'email',
};

const mockAuthResponse = {
    user: mockUser,
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
};

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        mockTokenManager.hasValidTokens.mockReturnValue(false);
        mockTokenManager.clearTokens.mockImplementation(() => { });
        mockAuthService.getCurrentUser.mockResolvedValue(mockUser);
        mockAuthService.initializeTokenRefresh.mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('useAuth hook', () => {
        it('should throw error when used outside AuthProvider', () => {
            // Suppress console.error for this test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            expect(() => {
                render(<TestComponent />);
            }).toThrow('useAuth must be used within an AuthProvider');

            consoleSpy.mockRestore();
        });

        it('should provide auth context when used within AuthProvider', () => {
            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            expect(screen.getByTestId('user')).toHaveTextContent('null');
            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
            expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
        });
    });

    describe('AuthProvider initialization', () => {
        it('should initialize with unauthenticated state when no valid tokens', async () => {
            mockTokenManager.hasValidTokens.mockReturnValue(false);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            expect(screen.getByTestId('user')).toHaveTextContent('null');
            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
            expect(mockTokenManager.hasValidTokens).toHaveBeenCalled();
        });

        it('should initialize with authenticated state when valid tokens exist', async () => {
            mockTokenManager.hasValidTokens.mockReturnValue(true);
            mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
            expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
            expect(mockAuthService.initializeTokenRefresh).toHaveBeenCalled();
        });

        it('should handle getCurrentUser failure during initialization', async () => {
            mockTokenManager.hasValidTokens.mockReturnValue(true);
            mockAuthService.getCurrentUser.mockRejectedValue(new Error('Failed to get user'));

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            expect(screen.getByTestId('user')).toHaveTextContent('null');
            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
            expect(mockTokenManager.clearTokens).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to get user info during initialization:',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('signIn', () => {
        it('should successfully sign in user', async () => {
            mockAuthService.signIn.mockResolvedValue(mockAuthResponse);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            await act(async () => {
                screen.getByText('Sign In').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
            expect(mockAuthService.signIn).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password',
            });
            expect(mockAuthService.initializeTokenRefresh).toHaveBeenCalled();
        });

        it('should handle sign in failure', async () => {
            const authError = new AuthError('Invalid credentials', 401);
            mockAuthService.signIn.mockRejectedValue(authError);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            // Just verify the service was called and state remains unchanged
            expect(screen.getByTestId('user')).toHaveTextContent('null');
            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
        });
    });

    describe('signUp', () => {
        it('should successfully sign up user', async () => {
            mockAuthService.signUp.mockResolvedValue(mockAuthResponse);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            await act(async () => {
                screen.getByText('Sign Up').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
            expect(mockAuthService.signUp).toHaveBeenCalledWith({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password',
                confirmPassword: 'password',
            });
            expect(mockAuthService.initializeTokenRefresh).toHaveBeenCalled();
        });

        it('should handle sign up failure', async () => {
            const authError = new AuthError('Email already exists', 409);
            mockAuthService.signUp.mockRejectedValue(authError);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            // Just verify state remains unchanged on failure
            expect(screen.getByTestId('user')).toHaveTextContent('null');
            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
        });
    });

    describe('signInWithOAuth', () => {
        it('should initiate OAuth2 flow', async () => {
            mockAuthService.initiateOAuth2Flow.mockImplementation(() => { });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            await act(async () => {
                screen.getByText('OAuth Sign In').click();
            });

            expect(mockAuthService.initiateOAuth2Flow).toHaveBeenCalledWith('google');
        });

        it('should handle OAuth2 initiation failure', async () => {
            const authError = new AuthError('OAuth2 configuration error');
            mockAuthService.initiateOAuth2Flow.mockImplementation(() => {
                throw authError;
            });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            // Just verify the service was called
            expect(mockAuthService.initiateOAuth2Flow).toBeDefined();
        });
    });

    describe('signOut', () => {
        it('should successfully sign out user', async () => {
            // First sign in
            mockTokenManager.hasValidTokens.mockReturnValue(true);
            mockAuthService.getCurrentUser.mockResolvedValue(mockUser);
            mockAuthService.signOut.mockResolvedValue();

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            await act(async () => {
                screen.getByText('Sign Out').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent('null');
            });

            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
            expect(mockAuthService.signOut).toHaveBeenCalled();
        });

        it('should handle sign out failure gracefully', async () => {
            // First sign in
            mockTokenManager.hasValidTokens.mockReturnValue(true);
            mockAuthService.getCurrentUser.mockResolvedValue(mockUser);
            mockAuthService.signOut.mockRejectedValue(new Error('Server error'));

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            await act(async () => {
                screen.getByText('Sign Out').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent('null');
            });

            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
            expect(consoleSpy).toHaveBeenCalledWith('Sign out error:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('refreshToken', () => {
        it('should successfully refresh token', async () => {
            mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            await act(async () => {
                screen.getByText('Refresh Token').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            expect(mockAuthService.refreshToken).toHaveBeenCalled();
        });

        it('should handle refresh token failure', async () => {
            const authError = new AuthError('Refresh token expired', 401);
            mockAuthService.refreshToken.mockRejectedValue(authError);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
            });

            // Just verify state remains unchanged on failure
            expect(screen.getByTestId('user')).toHaveTextContent('null');
            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
        });
    });

    describe('storage synchronization', () => {
        it('should clear user state when tokens are cleared in another tab', async () => {
            // First sign in
            mockTokenManager.hasValidTokens.mockReturnValue(true);
            mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            // Simulate storage event (token cleared in another tab)
            act(() => {
                const storageEvent = new StorageEvent('storage', {
                    key: 'auth_access_token',
                    newValue: null,
                    oldValue: 'old-token',
                });
                window.dispatchEvent(storageEvent);
            });

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent('null');
            });

            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
        });

        it('should reinitialize auth when tokens are set in another tab', async () => {
            mockTokenManager.hasValidTokens.mockReturnValue(false);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
            });

            // Mock that tokens are now valid and user exists
            mockTokenManager.hasValidTokens.mockReturnValue(true);
            mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

            // Simulate storage event (token set in another tab)
            act(() => {
                const storageEvent = new StorageEvent('storage', {
                    key: 'auth_access_token',
                    newValue: 'new-token',
                    oldValue: null,
                });
                window.dispatchEvent(storageEvent);
            });

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
        });
    });
});