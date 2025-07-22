/**
 * Utility functions for guest user management
 */

/**
 * Generates a random guest username
 * @returns A friendly guest username like "CoolGuest123"
 */
export const generateGuestUsername = (): string => {
  const adjectives = [
    'Cool', 'Smart', 'Happy', 'Bright', 'Swift', 'Kind', 
    'Bold', 'Calm', 'Clever', 'Friendly', 'Quick', 'Wise'
  ];
  
  const nouns = [
    'Guest', 'User', 'Visitor', 'Friend', 'Participant', 
    'Member', 'Attendee', 'Viewer', 'Speaker', 'Host'
  ];
  
  const randomNum = Math.floor(Math.random() * 1000);
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adjective}${noun}${randomNum}`;
};

/**
 * Checks if a username appears to be a generated guest username
 * @param username The username to check
 * @returns True if the username looks like a generated guest username
 */
export const isGuestUsername = (username: string): boolean => {
  // Simple heuristic: contains "Guest", "User", "Visitor", etc. followed by numbers
  const guestPattern = /(Guest|User|Visitor|Friend|Participant|Member|Attendee|Viewer|Speaker|Host)\d+$/;
  return guestPattern.test(username);
};

/**
 * Gets a display name for a user, handling both authenticated and guest users
 * @param user The authenticated user object (if any)
 * @param fallbackName The fallback name from URL params or other sources
 * @returns A display name for the user
 */
export const getUserDisplayName = (
  user: { username: string } | null, 
  fallbackName?: string
): string => {
  if (user?.username) {
    return user.username;
  }
  
  if (fallbackName) {
    return fallbackName;
  }
  
  return generateGuestUsername();
};