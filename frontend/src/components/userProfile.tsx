"use-client";

import React, { useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Avatar,
  Divider,
  Badge,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tabs,
  Tab,
  Switch,
} from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { 
  Mail, 
  User, 
  LogOut, 
  Shield, 
  ArrowRight, 
  Edit3, 
  Camera, 
  Save, 
  X,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle
} from "lucide-react";

export default function UserProfile() {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  
  // State for editing profile
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState("");
  const [editedEmail, setEditedEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // State for profile picture upload
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal controls
  const { isOpen: isAvatarModalOpen, onOpen: onAvatarModalOpen, onClose: onAvatarModalClose } = useDisclosure();
  
  // Settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [recordingReminders, setRecordingReminders] = useState(false);
  
  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Show notification helper
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Initialize edit form when editing starts
  const startEditing = () => {
    setEditedUsername(user?.username || "");
    setEditedEmail(user?.email || "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedUsername("");
    setEditedEmail("");
  };

  const saveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { AuthService } = await import('../services/authService');
      const updatedUser = await AuthService.updateProfile({ 
        username: editedUsername, 
        email: editedEmail 
      });
      
      console.log("Profile updated:", updatedUser);
      setIsEditing(false);
      showNotification('success', 'Profile updated successfully!');
    } catch (error) {
      console.error("Failed to update profile:", error);
      showNotification('error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }
      
      setSelectedImage(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async () => {
    if (!selectedImage) return;
    
    setIsUploadingAvatar(true);
    try {
      const { AuthService } = await import('../services/authService');
      const response = await AuthService.uploadAvatar(selectedImage);
      
      console.log("Avatar uploaded:", response);
      
      // Reset state
      setSelectedImage(null);
      setPreviewUrl(null);
      onAvatarModalClose();
      showNotification('success', 'Profile picture updated successfully!');
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      showNotification('error', 'Failed to upload profile picture. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    setIsRemovingAvatar(true);
    try {
      const { AuthService } = await import('../services/authService');
      const updatedUser = await AuthService.removeAvatar();
      
      console.log("Avatar removed:", updatedUser);
      onAvatarModalClose();
      showNotification('success', 'Profile picture removed successfully!');
    } catch (error) {
      console.error("Failed to remove avatar:", error);
      showNotification('error', 'Failed to remove profile picture. Please try again.');
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center p-12">
        <Spinner size="lg" color="primary" />
        <p className="mt-4 text-default-600">Loading your profile...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="max-w-md mx-auto border border-default-200 bg-default-50 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex gap-3">
          <User className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">User Profile</h2>
        </CardHeader>
        <Divider />
        <CardBody className="text-center py-10">
          <div className="mb-6">
            <Avatar name="Guest" size="lg" className="mx-auto mb-4" />
            <p className="text-lg font-medium">Not Signed In</p>
            <p className="text-default-500 mt-2">
              Please sign in to access your profile
            </p>
          </div>
          <Button
            variant="solid"
            color="primary"
            size="lg"
            onPress={() => navigate("/sign-in")}
            className="px-8"
            endContent={<ArrowRight className="h-4 w-4" />}
          >
            Sign In
          </Button>
        </CardBody>
      </Card>
    );
  }

  const fullName = user?.username || "";
  const email = user?.email || "";
  const initials = fullName
    .split(" ")
    .map((name) => name[0])
    .join("")
    .toUpperCase() || user?.username?.charAt(0).toUpperCase() || "U";

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
          notification.type === 'success' 
            ? 'bg-success-50 text-success-700 border border-success-200' 
            : 'bg-danger-50 text-danger-700 border border-danger-200'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{notification.message}</span>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setNotification(null)}
            className="ml-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <Card className="border border-default-200 bg-default-50 shadow-sm">
        <CardHeader className="flex justify-between items-center">
          <div className="flex gap-3 items-center">
            <User className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">User Profile</h2>
          </div>
          {!isEditing && (
            <Button
              variant="flat"
              color="primary"
              size="sm"
              startContent={<Edit3 className="h-4 w-4" />}
              onPress={startEditing}
            >
              Edit Profile
            </Button>
          )}
        </CardHeader>
        <Divider />
        
        <CardBody className="p-6">
          <Tabs aria-label="Profile sections" className="w-full">
            <Tab key="profile" title="Profile">
              <div className="space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    {user?.avatar ? (
                      <Avatar
                        src={user.avatar}
                        alt={fullName}
                        size="lg"
                        className="h-24 w-24"
                      />
                    ) : (
                      <Avatar
                        name={initials}
                        size="lg"
                        className="h-24 w-24 text-lg"
                      />
                    )}
                    <Button
                      isIconOnly
                      size="sm"
                      variant="solid"
                      color="primary"
                      className="absolute -bottom-1 -right-1"
                      onPress={onAvatarModalOpen}
                    >
                      <Camera className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {user?.provider && (
                    <Badge
                      color="primary"
                      variant="flat"
                      className="mt-3"
                      aria-label={`Authentication provider: ${user.provider}`}
                    >
                      {user.provider}
                    </Badge>
                  )}
                </div>

                {/* Profile Information */}
                <div className="space-y-4">
                  {isEditing ? (
                    <>
                      <Input
                        label="Username"
                        value={editedUsername}
                        onValueChange={setEditedUsername}
                        startContent={<User className="h-4 w-4 text-default-400" />}
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={editedEmail}
                        onValueChange={setEditedEmail}
                        startContent={<Mail className="h-4 w-4 text-default-400" />}
                        isDisabled={user?.provider !== 'email'}
                        description={user?.provider !== 'email' ? 'Email cannot be changed for OAuth accounts' : ''}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="flat"
                          onPress={cancelEditing}
                          startContent={<X className="h-4 w-4" />}
                        >
                          Cancel
                        </Button>
                        <Button
                          color="primary"
                          onPress={saveProfile}
                          isLoading={isSaving}
                          startContent={<Save className="h-4 w-4" />}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 p-3 bg-default-100 rounded-lg">
                        <User className="h-5 w-5 text-primary/70" />
                        <div>
                          <p className="font-medium">Username</p>
                          <p className="text-default-600">{fullName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-default-100 rounded-lg">
                        <Mail className="h-5 w-5 text-primary/70" />
                        <div>
                          <p className="font-medium">Email</p>
                          <p className="text-default-600">{email}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Account Status */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Account Status</h3>
                  <div className="flex justify-between items-center p-3 bg-default-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary/70" />
                      <span className="font-medium">Account Status</span>
                    </div>
                    <Badge color="success" variant="flat" aria-label="Account status: Active">
                      Active
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-default-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-primary/70" />
                      <span className="font-medium">Email Verification</span>
                    </div>
                    <Badge color="success" variant="flat" aria-label="Email verification status: Verified">
                      Verified
                    </Badge>
                  </div>
                </div>
              </div>
            </Tab>
            
            <Tab key="settings" title="Settings">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Notification Preferences</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-default-100 rounded-lg">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-default-600">Receive updates via email</p>
                    </div>
                    <Switch
                      isSelected={emailNotifications}
                      onValueChange={setEmailNotifications}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-default-100 rounded-lg">
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-default-600">Receive browser notifications</p>
                    </div>
                    <Switch
                      isSelected={pushNotifications}
                      onValueChange={setPushNotifications}
                    />
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-default-100 rounded-lg">
                    <div>
                      <p className="font-medium">Recording Reminders</p>
                      <p className="text-sm text-default-600">Get reminded about ongoing recordings</p>
                    </div>
                    <Switch
                      isSelected={recordingReminders}
                      onValueChange={setRecordingReminders}
                    />
                  </div>
                </div>

                <Divider />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Account Actions</h3>
                  <Button
                    variant="flat"
                    color="danger"
                    startContent={<LogOut className="h-4 w-4" />}
                    onPress={handleSignOut}
                    className="w-full"
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Avatar Upload Modal */}
      <Modal isOpen={isAvatarModalOpen} onClose={onAvatarModalClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Profile Picture
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {previewUrl ? (
                <div className="flex flex-col items-center">
                  <Avatar src={previewUrl} size="lg" className="h-32 w-32 mb-4" />
                  <p className="text-sm text-default-600">Preview</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  {user?.avatar ? (
                    <Avatar src={user.avatar} size="lg" className="h-32 w-32 mb-4" />
                  ) : (
                    <Avatar name={initials} size="lg" className="h-32 w-32 mb-4" />
                  )}
                  <p className="text-sm text-default-600">Current Picture</p>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              
              <div className="flex gap-2">
                <Button
                  variant="flat"
                  startContent={<Upload className="h-4 w-4" />}
                  onPress={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  Choose Image
                </Button>
                {user?.avatar && (
                  <Button
                    variant="flat"
                    color="danger"
                    startContent={<Trash2 className="h-4 w-4" />}
                    onPress={removeAvatar}
                    isLoading={isRemovingAvatar}
                    isDisabled={isUploadingAvatar}
                  >
                    Remove
                  </Button>
                )}
              </div>
              
              <p className="text-xs text-default-500">
                Supported formats: JPG, PNG, GIF. Max size: 5MB
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button 
              variant="light" 
              onPress={onAvatarModalClose}
              isDisabled={isUploadingAvatar || isRemovingAvatar}
            >
              Cancel
            </Button>
            {selectedImage && (
              <Button 
                color="primary" 
                onPress={uploadAvatar}
                isLoading={isUploadingAvatar}
                isDisabled={isRemovingAvatar}
              >
                Upload Picture
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}