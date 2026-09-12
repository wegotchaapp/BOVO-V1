import { SimpleConsoleLogger } from 'typeorm';
import type { QueryRunner } from 'typeorm';

/** Identity queries can contain image keys; never send their SQL/parameters to logs. */
export class PrivateQueryLogger extends SimpleConsoleLogger {
  private sensitive(query: string) {
    return /mobile_identity_verifications/i.test(query);
  }

  override logQuery(
    query: string,
    parameters?: unknown[],
    runner?: QueryRunner,
  ): void {
    if (this.sensitive(query))
      super.logQuery('[private identity query]', undefined, runner);
    else super.logQuery(query, parameters, runner);
  }

  override logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[],
    runner?: QueryRunner,
  ): void {
    if (this.sensitive(query))
      super.logQueryError(
        'Private identity query failed',
        '[private identity query]',
        undefined,
        runner,
      );
    else
      super.logQueryError(
        error instanceof Error ? error.message : error,
        query,
        parameters,
        runner,
      );
  }

  override logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[],
    runner?: QueryRunner,
  ): void {
    if (this.sensitive(query))
      super.logQuerySlow(time, '[private identity query]', undefined, runner);
    else super.logQuerySlow(time, query, parameters, runner);
  }
}
