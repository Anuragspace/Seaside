import { describe, it, expect } from 'vitest';
import { generateGuestUsername, isGuestUsername, getUserDisplayName } from '../guestUtils';

describe('guestUtils', () => {
  describe('generateGuestUsername', () => {
    it('generates a username with the correct format', () => {
      const username = generateGuestUsername();
      
      // Should match pattern: AdjectiveNounNumber
      expect(username).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d+$/);
    });

    it('generates different usernames on multiple calls', () => {
      const username1 = generateGuestUsername();
      const username2 = generateGuestUsername();
      
      // Very unlikely to be the same due to random components
      expect(username1).not.toBe(username2);
    });

    it('generates usernames with numbers between 0-999', () => {
      // Generate multiple usernames and check number range
      for (let i = 0; i < 10; i++) {
        const username = generateGuestUsername();
        const numberMatch = username.match(/(\d+)$/);
        
        expect(numberMatch).toBeTruthy();
        if (numberMatch) {
          const number = parseInt(numberMatch[1]);
          expect(number).toBeGreaterThanOrEqual(0);
          expect(number).toBeLessThan(1000);
        }
      }
    });
  });

  describe('isGuestUsername', () => {
    it('identifies generated guest usernames correctly', () => {
      const guestUsernames = [
        'CoolGuest123',
        'SmartUser456',
        'HappyVisitor789',
        'BrightFriend001',
        'SwiftParticipant999'
      ];

      guestUsernames.forEach(username => {
        expect(isGuestUsername(username)).toBe(true);
      });
    });

    it('identifies non-guest usernames correctly', () => {
      const regularUsernames = [
        'john_doe',
        'alice.smith',
        'testuser',
        'user123name',
        'CoolGuestName', // No numbers at end
        'Guest', // No numbers
        '123Guest', // Numbers at start
        'MyGuest123Name' // Numbers not at end
      ];

      regularUsernames.forEach(username => {
        expect(isGuestUsername(username)).toBe(false);
      });
    });

    it('handles edge cases', () => {
      expect(isGuestUsername('')).toBe(false);
      expect(isGuestUsername('Guest')).toBe(false);
      expect(isGuestUsername('123')).toBe(false);
      expect(isGuestUsername('User0')).toBe(true);
    });
  });

  describe('getUserDisplayName', () => {
    it('returns authenticated user username when available', () => {
      const user = { username: 'authenticatedUser' };
      const result = getUserDisplayName(user, 'fallbackName');
      
      expect(result).toBe('authenticatedUser');
    });

    it('returns fallback name when user is null and fallback is provided', () => {
      const result = getUserDisplayName(null, 'fallbackName');
      
      expect(result).toBe('fallbackName');
    });

    it('generates guest username when both user and fallback are null/undefined', () => {
      const result = getUserDisplayName(null);
      
      expect(result).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d+$/);
      expect(isGuestUsername(result)).toBe(true);
    });

    it('returns fallback name over generated name when provided', () => {
      const result = getUserDisplayName(null, 'customName');
      
      expect(result).toBe('customName');
    });

    it('handles user with empty username', () => {
      const user = { username: '' };
      const result = getUserDisplayName(user, 'fallbackName');
      
      expect(result).toBe('fallbackName');
    });

    it('handles user with empty username and no fallback', () => {
      const user = { username: '' };
      const result = getUserDisplayName(user);
      
      expect(result).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d+$/);
      expect(isGuestUsername(result)).toBe(true);
    });
  });
});