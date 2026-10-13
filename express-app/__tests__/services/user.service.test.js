/**
 * User Service Tests
 */

const {
  buildUserStatsDict,
  dateComparator,
  getActiveUserConditions,
} = require('../../services/user.service');

describe('User Service', () => {
  describe('buildUserStatsDict', () => {
    it('should return empty stats for empty results array', () => {
      const result = buildUserStatsDict([]);

      expect(result).toEqual({
        nTries: 0,
        nSeconds: 0,
        userHits: 0,
        userFails: 0,
        userOmissions: 0,
      });
    });

    it('should calculate stats correctly from test results', () => {
      const testResults = [
        { score: 80, nSeconds: 120, hits: 8, fails: 1, omissions: 1 },
        { score: 90, nSeconds: 100, hits: 9, fails: 1, omissions: 0 },
      ];

      const result = buildUserStatsDict(testResults);

      expect(result).toEqual({
        nTries: 2,
        nSeconds: 220,
        userHits: 17,
        userFails: 2,
        userOmissions: 1,
      });
    });

    it('should skip personality test results (score === -1)', () => {
      const testResults = [
        { score: 80, nSeconds: 120, hits: 8, fails: 1, omissions: 1 },
        { score: -1, nSeconds: 60, hits: 0, fails: 0, omissions: 0 }, // Personality test
      ];

      const result = buildUserStatsDict(testResults);

      expect(result.nTries).toBe(2); // Counts both
      expect(result.nSeconds).toBe(120); // Only counts first
      expect(result.userHits).toBe(8);
    });

    it('should handle null/undefined values gracefully', () => {
      const testResults = [
        { score: 80, nSeconds: null, hits: undefined, fails: 1, omissions: 1 },
      ];

      const result = buildUserStatsDict(testResults);

      expect(result.nSeconds).toBe(0);
      expect(result.userHits).toBe(0);
    });
  });

  describe('dateComparator', () => {
    it('should sort by nested date field in descending order', () => {
      const items = [
        { data: { createdAt: new Date('2023-01-01') } },
        { data: { createdAt: new Date('2023-06-01') } },
        { data: { createdAt: new Date('2023-03-01') } },
      ];

      items.sort(dateComparator('data'));

      expect(items[0].data.createdAt.getTime()).toBeGreaterThan(
        items[1].data.createdAt.getTime()
      );
      expect(items[1].data.createdAt.getTime()).toBeGreaterThan(
        items[2].data.createdAt.getTime()
      );
    });
  });

  describe('getActiveUserConditions', () => {
    it('should return empty conditions for admin', () => {
      const result = getActiveUserConditions(true);

      expect(result).toEqual({});
    });

    it('should return filter conditions for non-admin', () => {
      const result = getActiveUserConditions(false);

      expect(result[require('sequelize').Op.and]).toEqual(expect.arrayContaining([{ username: { [require('sequelize').Op.notLike]: '%deleted-%' } }]));
    });
  });
});
