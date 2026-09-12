import { PrivateQueryLogger } from './private-query.logger';

describe('PrivateQueryLogger', () => {
  it('redacts SQL, parameters and driver error details for identity queries', () => {
    const calls: unknown[][] = [];
    const spies = [
      jest.spyOn(console, 'log'),
      jest.spyOn(console, 'info'),
      jest.spyOn(console, 'warn'),
      jest.spyOn(console, 'error'),
    ];
    spies.forEach((spy) =>
      spy.mockImplementation((...args: unknown[]) => {
        calls.push(args);
      }),
    );
    try {
      const logger = new PrivateQueryLogger(true);
      const sql =
        "INSERT INTO mobile_identity_verifications VALUES ('private-image-key')";
      logger.logQuery(sql, ['private-image-key']);
      logger.logQueryError(new Error('duplicate private-image-key'), sql, [
        'private-image-key',
      ]);
      logger.logQuerySlow(100, sql, ['private-image-key']);
      const output = JSON.stringify(calls);
      expect(output).toContain('private identity query');
      expect(output).not.toContain('private-image-key');
      logger.logQuery('SELECT 1');
      expect(JSON.stringify(calls)).toContain('SELECT 1');
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});
