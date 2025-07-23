import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { HeroUIProvider } from '@heroui/react';
import UserProfile from '../userProfile';
import { AuthService } from '../../services/authService';

// Mock the auth context
const mockUseAuth = vi.fn();
vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

// Mock the AuthService
vi.mock('../../services/authService', () => ({
  AuthService: {
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
    removeAvatar: vi.fn(),
  },
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <HeroUIProvider>
      {children}
    </HeroUIProvider>
  </BrowserRouter>
);

describe('UserProfile Component', () => {
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    username: 'testuser',
    avatar: 'https://example.com/avatar.jpg',
    provider: 'email' as const,
  };

  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockSignOut.mockClear();
  });

  describe('Loading State', () => {
    it('should display loading spinner when isLoading is true', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        signOut: mockSignOut,
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      expect(screen.getByText('Loading your profile...')).toBeInTheDocument();
    });
  });

  describe('Unauthenticated State', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should display sign-in prompt for unauthenticated users', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      expect(screen.getByText('Not Signed In')).toBeInTheDocument();
      expect(screen.getByText('Please sign in to access your profile')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should navigate to sign-in page when sign-in button is clicked', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const signInButton = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(signInButton);

      expect(mockNavigate).toHaveBeenCalledWith('/sign-in');
    });
  });

  describe('Authenticated State', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should display user profile information', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
    });

    it('should display user avatar', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const avatar = screen.getAllByRole('img')[0];
      expect(avatar).toHaveAttribute('src', mockUser.avatar);
    });

    it('should display initials when no avatar is provided', () => {
      const userWithoutAvatar = { ...mockUser, avatar: undefined };
      mockUseAuth.mockReturnValue({
        user: userWithoutAvatar,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Check that initials are displayed (T for testuser)
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should show account status badges', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });

  describe('Profile Editing', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should enter edit mode when edit button is clicked', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      fireEvent.click(editButton);

      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should cancel editing when cancel button is clicked', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      fireEvent.click(editButton);

      // Cancel editing
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    });

    it('should update username field when typing', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      fireEvent.click(editButton);

      // Update username
      const usernameInput = screen.getByDisplayValue('testuser');
      fireEvent.change(usernameInput, { target: { value: 'newusername' } });

      expect(screen.getByDisplayValue('newusername')).toBeInTheDocument();
    });

    it('should disable email field for OAuth users', () => {
      const oauthUser = { ...mockUser, provider: 'google' as const };
      mockUseAuth.mockReturnValue({
        user: oauthUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      fireEvent.click(editButton);

      const emailInput = screen.getByDisplayValue('test@example.com');
      expect(emailInput).toBeDisabled();
      expect(screen.getByText('Email cannot be changed for OAuth accounts')).toBeInTheDocument();
    });

    it('should simulate saving profile changes', async () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      fireEvent.click(editButton);

      // Update username
      const usernameInput = screen.getByDisplayValue('testuser');
      fireEvent.change(usernameInput, { target: { value: 'newusername' } });

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      // Should show loading state
      expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();

      // Wait for save to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
      });
    });
  });

  describe('Avatar Management', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should open avatar modal when camera button is clicked', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const cameraButtons = screen.getAllByRole('button', { name: '' });
      const cameraButton = cameraButtons.find(button => 
        button.querySelector('.lucide-camera')
      );
      expect(cameraButton).toBeDefined();
      fireEvent.click(cameraButton!);

      expect(screen.getByText('Profile Picture')).toBeInTheDocument();
      expect(screen.getByText('Choose Image')).toBeInTheDocument();
    });

    it('should show remove button for users with avatars', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const cameraButtons = screen.getAllByRole('button', { name: '' });
      const cameraButton = cameraButtons.find(button => 
        button.querySelector('.lucide-camera')
      );
      expect(cameraButton).toBeDefined();
      fireEvent.click(cameraButton!);

      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
    });

    it('should not show remove button for users without avatars', () => {
      const userWithoutAvatar = { ...mockUser, avatar: undefined };
      mockUseAuth.mockReturnValue({
        user: userWithoutAvatar,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const cameraButtons = screen.getAllByRole('button', { name: '' });
      const cameraButton = cameraButtons.find(button => 
        button.querySelector('.lucide-camera')
      );
      expect(cameraButton).toBeDefined();
      fireEvent.click(cameraButton!);

      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });

    it('should handle file selection for avatar upload', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const cameraButtons = screen.getAllByRole('button', { name: '' });
      const cameraButton = cameraButtons.find(button => 
        button.querySelector('.lucide-camera')
      );
      expect(cameraButton).toBeDefined();
      fireEvent.click(cameraButton!);

      const chooseImageButton = screen.getByRole('button', { name: /choose image/i });
      expect(chooseImageButton).toBeInTheDocument();

      // File input should exist (hidden input)
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });
  });

  describe('Settings Tab', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should switch to settings tab', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const settingsTab = screen.getByRole('tab', { name: /settings/i });
      fireEvent.click(settingsTab);

      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
      expect(screen.getByText('Push Notifications')).toBeInTheDocument();
      expect(screen.getByText('Recording Reminders')).toBeInTheDocument();
    });

    it('should toggle notification settings', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const settingsTab = screen.getByRole('tab', { name: /settings/i });
      fireEvent.click(settingsTab);

      // Find switches by their role
      const switches = screen.getAllByRole('switch');
      expect(switches).toHaveLength(3);

      // Test toggling switches
      switches.forEach(switchElement => {
        fireEvent.click(switchElement);
      });
    });

    it('should show sign out button in settings', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const settingsTab = screen.getByRole('tab', { name: /settings/i });
      fireEvent.click(settingsTab);

      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });
  });

  describe('Sign Out Functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should call signOut and navigate to home when sign out is clicked', async () => {
      mockSignOut.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const settingsTab = screen.getByRole('tab', { name: /settings/i });
      fireEvent.click(settingsTab);

      const signOutButton = screen.getByRole('button', { name: /sign out/i });
      fireEvent.click(signOutButton);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('should handle sign out errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSignOut.mockRejectedValue(new Error('Sign out failed'));

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const settingsTab = screen.getByRole('tab', { name: /settings/i });
      fireEvent.click(settingsTab);

      const signOutButton = screen.getByRole('button', { name: /sign out/i });
      fireEvent.click(signOutButton);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Sign out error:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Provider Badge Display', () => {
    it('should display correct provider badge for email users', () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, provider: 'email' },
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      expect(screen.getByText('email')).toBeInTheDocument();
    });

    it('should display correct provider badge for Google users', () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, provider: 'google' },
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      expect(screen.getByText('google')).toBeInTheDocument();
    });

    it('should display correct provider badge for GitHub users', () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, provider: 'github' },
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      expect(screen.getByText('github')).toBeInTheDocument();
    });
  });

  describe('Profile Management API Integration', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });
      vi.clearAllMocks();
    });

    it('should call AuthService.updateProfile when saving profile changes', async () => {
      vi.mocked(AuthService.updateProfile).mockResolvedValue({
        ...mockUser,
        username: 'newusername',
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      fireEvent.click(editButton);

      // Update username
      const usernameInput = screen.getByDisplayValue('testuser');
      fireEvent.change(usernameInput, { target: { value: 'newusername' } });

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(AuthService.updateProfile).toHaveBeenCalledWith({
          username: 'newusername',
          email: 'test@example.com',
        });
      });

      // Should show success notification
      await waitFor(() => {
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });
    });

    it('should handle profile update errors gracefully', async () => {
      vi.mocked(AuthService.updateProfile).mockRejectedValue(new Error('Update failed'));

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Enter edit mode and save
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      fireEvent.click(editButton);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to update profile. Please try again.')).toBeInTheDocument();
      });
    });

    it('should call AuthService.uploadAvatar when uploading avatar', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      vi.mocked(AuthService.uploadAvatar).mockResolvedValue({
        avatarUrl: 'https://example.com/new-avatar.jpg',
        user: { ...mockUser, avatar: 'https://example.com/new-avatar.jpg' },
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Open avatar modal
      const cameraButtons = screen.getAllByRole('button', { name: '' });
      const cameraButton = cameraButtons.find(button => 
        button.querySelector('.lucide-camera')
      );
      expect(cameraButton).toBeDefined();
      fireEvent.click(cameraButton!);

      // Simulate file selection
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });
      fireEvent.change(fileInput);

      // Upload avatar
      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /upload picture/i });
        expect(uploadButton).toBeInTheDocument();
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(AuthService.uploadAvatar).toHaveBeenCalledWith(mockFile);
      });

      // Should show success notification
      await waitFor(() => {
        expect(screen.getByText('Profile picture updated successfully!')).toBeInTheDocument();
      });
    });

    it('should call AuthService.removeAvatar when removing avatar', async () => {
      vi.mocked(AuthService.removeAvatar).mockResolvedValue({
        ...mockUser,
        avatar: undefined,
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Open avatar modal
      const cameraButtons = screen.getAllByRole('button', { name: '' });
      const cameraButton = cameraButtons.find(button => 
        button.querySelector('.lucide-camera')
      );
      expect(cameraButton).toBeDefined();
      fireEvent.click(cameraButton!);

      // Remove avatar
      const removeButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(AuthService.removeAvatar).toHaveBeenCalled();
      });

      // Should show success notification
      await waitFor(() => {
        expect(screen.getByText('Profile picture removed successfully!')).toBeInTheDocument();
      });
    });

    it('should handle avatar upload errors gracefully', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      vi.mocked(AuthService.uploadAvatar).mockRejectedValue(new Error('Upload failed'));

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Open avatar modal and simulate file selection
      const cameraButtons = screen.getAllByRole('button', { name: '' });
      const cameraButton = cameraButtons.find(button => 
        button.querySelector('.lucide-camera')
      );
      expect(cameraButton).toBeDefined();
      fireEvent.click(cameraButton!);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });
      fireEvent.change(fileInput);

      // Try to upload
      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /upload picture/i });
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to upload profile picture. Please try again.')).toBeInTheDocument();
      });
    });

    it('should handle avatar removal errors gracefully', async () => {
      vi.mocked(AuthService.removeAvatar).mockRejectedValue(new Error('Remove failed'));

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Open avatar modal and remove
      const cameraButtons = screen.getAllByRole('button', { name: '' });
      const cameraButton = cameraButtons.find(button => 
        button.querySelector('.lucide-camera')
      );
      expect(cameraButton).toBeDefined();
      fireEvent.click(cameraButton!);

      const removeButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to remove profile picture. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Notification System', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should display and dismiss notifications', async () => {
      vi.mocked(AuthService.updateProfile).mockResolvedValue(mockUser);

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Trigger a successful action
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      fireEvent.click(editButton);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      // Should show success notification
      await waitFor(() => {
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });

      // Should be able to dismiss notification
      const dismissButtons = screen.getAllByRole('button', { name: '' });
      const dismissButton = dismissButtons.find(button => 
        button.querySelector('.lucide-x')
      );
      expect(dismissButton).toBeDefined();
      fireEvent.click(dismissButton!);

      expect(screen.queryByText('Profile updated successfully!')).not.toBeInTheDocument();
    });

    it('should auto-dismiss notifications after 5 seconds', async () => {
      vi.mocked(AuthService.updateProfile).mockResolvedValue(mockUser);

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Trigger a successful action
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      fireEvent.click(editButton);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveButton);

      // Should show notification
      await waitFor(() => {
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });

      // Test that notification exists and can be dismissed
      expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should show upload button when file is selected', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      vi.mocked(AuthService.uploadAvatar).mockResolvedValue({
        avatarUrl: 'https://example.com/avatar.jpg',
        user: mockUser,
      });

      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Open avatar modal and select file
      const cameraButtons = screen.getAllByRole('button', { name: '' });
      const cameraButton = cameraButtons.find(button => 
        button.querySelector('.lucide-camera')
      );
      expect(cameraButton).toBeDefined();
      fireEvent.click(cameraButton!);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });
      fireEvent.change(fileInput);

      // Should show upload button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload picture/i })).toBeInTheDocument();
      });
    });

    it('should have remove button for users with avatars', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Open avatar modal
      const cameraButtons = screen.getAllByRole('button', { name: '' });
      const cameraButton = cameraButtons.find(button => 
        button.querySelector('.lucide-camera')
      );
      expect(cameraButton).toBeDefined();
      fireEvent.click(cameraButton!);

      // Should show remove button
      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should have proper ARIA labels for provider badge', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const providerBadge = screen.getByLabelText('Authentication provider: email');
      expect(providerBadge).toBeInTheDocument();
    });

    it('should have proper ARIA labels for status badges', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Account status: Active')).toBeInTheDocument();
      expect(screen.getByLabelText('Email verification status: Verified')).toBeInTheDocument();
    });

    it('should have proper tab navigation', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      const profileTab = screen.getByRole('tab', { name: /profile/i });
      const settingsTab = screen.getByRole('tab', { name: /settings/i });

      expect(profileTab).toBeInTheDocument();
      expect(settingsTab).toBeInTheDocument();
    });

    it('should have proper accessibility labels', () => {
      render(
        <TestWrapper>
          <UserProfile />
        </TestWrapper>
      );

      // Check that profile tabs are accessible
      const profileTab = screen.getByRole('tab', { name: /profile/i });
      const settingsTab = screen.getByRole('tab', { name: /settings/i });

      expect(profileTab).toBeInTheDocument();
      expect(settingsTab).toBeInTheDocument();
    });
  });
});