import { Controller, Get, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { UserRole } from '../../common/enums';

@ApiTags('audit')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), RbacGuard)
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiBearerAuth('JWT')
  @Roles(UserRole.TS_AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get audit trail with filters (admin/ts_agent only)' })
  async getAuditTrail(
    @Query('actor_id') actorId?: string,
    @Query('entity_type') entityType?: string,
    @Query('event_type') eventType?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.getAuditEvents({
      actorId,
      entityType,
      eventType,
      startDate,
      endDate,
      page: parseInt(String(page)) || 1,
      limit: parseInt(String(limit)) || 50,
    });
  }

  @Get(':id')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.TS_AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a single audit event by ID' })
  async getEvent(@Param('id') id: string) {
    const event = await this.auditService.getEventById(id);
    if (!event) {
      return { error: 'Event not found' };
    }
    return event;
  }

  @Get('entity/:entityType/:entityId')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.TS_AGENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get audit trail for a specific entity' })
  async getEntityTrail(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getAuditTrail(entityType, entityId);
  }

  @Get('immutability-policy')
  @ApiOperation({ summary: 'Returns the RLS policy that enforces audit log immutability' })
  getImmutabilityPolicy() {
    return {
      policy: 'AUDIT_EVENTS_IMMUTABLE_RLS',
      description: 'INSERT-only policy enforced at database level. No role, including admin or superuser, can UPDATE or DELETE audit_events records through application queries.',
      sql: `
-- RLS Policy: INSERT-only for audit_events table
-- Even admins cannot UPDATE or DELETE

-- Enable RLS
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Allow INSERT for authenticated roles (application, agents, admins)
CREATE POLICY audit_events_insert_only
  ON audit_events
  FOR INSERT
  TO authenticated, ts_agent_role, admin_role
  WITH CHECK (true);

-- Allow SELECT for viewing (admins, ts_agents)
CREATE POLICY audit_events_select
  ON audit_events
  FOR SELECT
  TO ts_agent_role, admin_role
  USING (true);

-- EXPLICIT DENY: No UPDATE or DELETE policies exist
-- PostgreSQL RLS defaults to DENY when no policy matches
-- This means:
--   UPDATE audit_events ... => DENIED (no policy)
--   DELETE FROM audit_events ... => DENIED (no policy)
-- Even superuser bypass is prevented by application-layer guards:
--   auditService.deleteEvent() throws ForbiddenException
--   auditService.updateEvent() throws ForbiddenException

-- Additional PostgreSQL-level protection (optional but recommended):
-- CREATE OR REPLACE FUNCTION prevent_audit_update() RETURNS TRIGGER AS $$
-- BEGIN
--   RAISE EXCEPTION 'Audit events are immutable. UPDATE is not allowed.';
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE OR REPLACE FUNCTION prevent_audit_delete() RETURNS TRIGGER AS $$
-- BEGIN
--   RAISE EXCEPTION 'Audit events are immutable. DELETE is not allowed.';
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER audit_events_no_update
--   BEFORE UPDATE ON audit_events
--   FOR EACH ROW EXECUTE FUNCTION prevent_audit_update();

-- CREATE TRIGGER audit_events_no_delete
--   BEFORE DELETE ON audit_events
--   FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_delete();
`,
    };
  }
}
