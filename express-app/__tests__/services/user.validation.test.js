/**
 * User Validation Tests
 */

const {
  validateUsername,
  validateName,
  validateDescription,
  validateUserUpdate,
  checkUserPermission,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
  DESC_MAX_LENGTH,
} = require('../../services/user.validation');

// Mock the User model
jest.mock('../../models', () => ({
  models: {
    User: {
      findOne: jest.fn(),
    },
  },
}));

const { models } = require('../../models');

describe('User Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUsername', () => {
    it('should accept a valid username', async () => {
      models.User.findOne.mockResolvedValue(null); // Username not taken

      const result = await validateUsername('validuser');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject username that is too short', async () => {
      const result = await validateUsername('ab');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters long.`
      );
    });

    it('should reject username that is too long', async () => {
      const result = await validateUsername('thisusernameiswaytoolong');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters long.`
      );
    });

    it('should reject username with uppercase letters', async () => {
      const result = await validateUsername('InvalidUser');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username can only contain lowercase letters, numbers, and dashes.'
      );
    });

    it('should reject username with special characters', async () => {
      const result = await validateUsername('user@name!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username can only contain lowercase letters, numbers, and dashes.'
      );
    });

    it('should reject username containing forbidden words', async () => {
      const result = await validateUsername('adminuser');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username cannot contain reserved words like \'admin\', \'deleted\', \'moderator\', etc.'
      );
    });

    it('should reject username starting with a dash', async () => {
      const result = await validateUsername('-username');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username cannot start or end with a dash.'
      );
    });

    it('should reject username ending with a dash', async () => {
      const result = await validateUsername('username-');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username cannot start or end with a dash.'
      );
    });

    it('should reject username starting with forbidden prefix', async () => {
      const result = await validateUsername('t-username');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Username cannot start with reserved prefixes like \'t-\', \'temp-\', or \'deleted-\'.'
      );
    });

    it('should reject username that is already taken', async () => {
      models.User.findOne.mockResolvedValue({ id: 1, username: 'takenuser' });

      const result = await validateUsername('takenuser');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Username is already in use.');
    });

    it('should skip validation if username matches current username', async () => {
      const result = await validateUsername('currentuser', 'currentuser');

      expect(result.isValid).toBe(true);
      expect(models.User.findOne).not.toHaveBeenCalled();
    });

    it('should accept username with numbers', async () => {
      models.User.findOne.mockResolvedValue(null);

      const result = await validateUsername('user123');

      expect(result.isValid).toBe(true);
    });

    it('should accept username with dashes in middle', async () => {
      models.User.findOne.mockResolvedValue(null);

      const result = await validateUsername('user-name');

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateName', () => {
    it('should accept a valid name', () => {
      const result = validateName('John Doe');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept empty name', () => {
      const result = validateName('');

      expect(result.isValid).toBe(true);
    });

    it('should accept null name', () => {
      const result = validateName(null);

      expect(result.isValid).toBe(true);
    });

    it('should reject name that is too long', () => {
      const longName = 'a'.repeat(NAME_MAX_LENGTH + 1);
      const result = validateName(longName);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Name must be under ${NAME_MAX_LENGTH} characters long.`
      );
    });
  });

  describe('validateDescription', () => {
    it('should accept a valid description', () => {
      const result = validateDescription('This is a valid description.');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept empty description', () => {
      const result = validateDescription('');

      expect(result.isValid).toBe(true);
    });

    it('should reject description that is too long', () => {
      const longDesc = 'a'.repeat(DESC_MAX_LENGTH + 1);
      const result = validateDescription(longDesc);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Description must be under ${DESC_MAX_LENGTH} characters long.`
      );
    });
  });

  describe('validateUserUpdate', () => {
    it('should validate all fields together', async () => {
      models.User.findOne.mockResolvedValue(null);

      const result = await validateUserUpdate({
        username: 'newuser',
        name: 'New User',
        desc: 'A new user description',
      });

      expect(result.isValid).toBe(true);
    });

    it('should collect all validation errors', async () => {
      const result = await validateUserUpdate({
        username: 'INVALID',
        name: 'a'.repeat(100),
        desc: 'a'.repeat(500),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should skip fields that are not provided', async () => {
      const result = await validateUserUpdate({});

      expect(result.isValid).toBe(true);
    });
  });

  describe('checkUserPermission', () => {
    it('should allow owner to modify their own profile', () => {
      const sessionUser = { username: 'testuser', isAdmin: false };
      const result = checkUserPermission(sessionUser, 'testuser');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('should allow admin to modify any profile', () => {
      const sessionUser = { username: 'admin', isAdmin: true };
      const result = checkUserPermission(sessionUser, 'someuser');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('should deny non-owner, non-admin users', () => {
      const sessionUser = { username: 'otheruser', isAdmin: false };
      const result = checkUserPermission(sessionUser, 'testuser');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not authorized');
    });

    it('should deny unauthenticated users', () => {
      const result = checkUserPermission(null, 'testuser');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Authentication required');
    });

  });
});
