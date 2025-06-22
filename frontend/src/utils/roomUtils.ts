/**
 * Generates a random 6-character room ID using alphanumeric characters
 */
export const generateRoomId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

/**
 * Validates if a room ID is in the correct format
 */
export const validateRoomId = (roomId: string): boolean => {
  return /^[a-zA-Z0-9]{6}$/.test(roomId);
};