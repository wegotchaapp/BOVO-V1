import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  MobileTrip,
  MobileTripGroup,
  MobileTripGroupMember,
  MobileTripGroupMessage,
  MobileUser,
} from '../entities/mobile.entities';
import { GroupMessageBody } from '../dto/mobile.dto';
import { groupSummaryDto } from '../mobile.mappers';

@Injectable()
export class MobileGroupsService {
  constructor(
    @InjectRepository(MobileTripGroup)
    private readonly groups: Repository<MobileTripGroup>,
    @InjectRepository(MobileTripGroupMember)
    private readonly members: Repository<MobileTripGroupMember>,
    @InjectRepository(MobileTripGroupMessage)
    private readonly messages: Repository<MobileTripGroupMessage>,
    @InjectRepository(MobileTrip)
    private readonly trips: Repository<MobileTrip>,
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
    private readonly dataSource: DataSource,
  ) {}

  async mine(userId: string) {
    const myMemberships = await this.members.find({
      where: { user_id: userId },
    });
    if (myMemberships.length === 0) return { groups: [] };

    const groupIds = myMemberships.map((m) => m.group_id);
    const groupRows = await this.groups.find({
      where: { id: In(groupIds) },
      order: { created_at: 'DESC' },
    });

    const tripIds = groupRows.map((g) => g.trip_id);
    const tripRows = tripIds.length
      ? await this.trips.find({ where: { id: In(tripIds) } })
      : [];
    const tripById = new Map(tripRows.map((t) => [t.id, t]));

    const memberCounts = await this.members.find({
      where: { group_id: In(groupIds) },
    });
    const countMap = new Map<string, number>();
    for (const m of memberCounts) {
      countMap.set(m.group_id, (countMap.get(m.group_id) ?? 0) + 1);
    }

    const msgRows = await this.messages.find({
      where: { group_id: In(groupIds) },
      order: { created_at: 'DESC' },
    });
    const latestMap = new Map<string, string>();
    for (const m of msgRows) {
      if (!latestMap.has(m.group_id)) latestMap.set(m.group_id, m.text);
    }

    const groups = groupRows
      .map((g) => {
        const trip = tripById.get(g.trip_id);
        if (!trip) return null;
        return groupSummaryDto({
          group: g,
          trip,
          memberCount: countMap.get(g.id) ?? 0,
          latestMessage: latestMap.get(g.id) ?? null,
        });
      })
      .filter(Boolean);

    return { groups };
  }

  async detail(userId: string, groupId: string) {
    const self = await this.requireMembership(groupId, userId);
    return this.buildDetail(self.group, self.trip, userId);
  }

  async postMessage(userId: string, groupId: string, dto: GroupMessageBody) {
    await this.requireMembership(groupId, userId);
    const text = dto.text.trim();
    const inserted = await this.messages.save(
      this.messages.create({
        group_id: groupId,
        sender_id: userId,
        text,
        is_system: false,
      }),
    );
    const sender = await this.users.findOne({ where: { id: userId } });
    return {
      message: {
        id: inserted.id,
        senderId: inserted.sender_id,
        senderName: sender?.name ?? null,
        text: inserted.text,
        isSystem: inserted.is_system,
        createdAt: inserted.created_at.toISOString(),
      },
    };
  }

  async remove(userId: string, groupId: string) {
    const membership = await this.members.findOne({
      where: { group_id: groupId, user_id: userId },
    });
    if (!membership) throw new NotFoundException('Group not found');
    if (membership.role !== 'driver') {
      throw new ForbiddenException('Only the Voyager can delete this group.');
    }
    await this.dataSource.transaction(async (tx) => {
      await tx.getRepository(MobileTripGroupMessage).delete({ group_id: groupId });
      await tx.getRepository(MobileTripGroupMember).delete({ group_id: groupId });
      await tx.getRepository(MobileTripGroup).delete({ id: groupId });
    });
    return { ok: true };
  }

  private async requireMembership(groupId: string, userId: string) {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    const membership = await this.members.findOne({
      where: { group_id: groupId, user_id: userId },
    });
    if (!membership) throw new NotFoundException('Group not found');
    const trip = await this.trips.findOne({ where: { id: group.trip_id } });
    if (!trip) throw new NotFoundException('Group not found');
    return { group, trip };
  }

  private async buildDetail(
    group: MobileTripGroup,
    trip: MobileTrip,
    _currentUserId: string,
  ) {
    const memberRows = await this.members.find({
      where: { group_id: group.id },
    });
    const userIds = memberRows.map((m) => m.user_id);
    const userRows = userIds.length
      ? await this.users.find({ where: { id: In(userIds) } })
      : [];
    const nameById = new Map(userRows.map((u) => [u.id, u.name]));

    const messageRows = await this.messages.find({
      where: { group_id: group.id },
      order: { created_at: 'ASC' },
    });

    return {
      group: groupSummaryDto({
        group,
        trip,
        memberCount: memberRows.length,
        latestMessage:
          messageRows.length > 0
            ? messageRows[messageRows.length - 1].text
            : null,
      }),
      members: memberRows.map((m) => ({
        userId: m.user_id,
        name: nameById.get(m.user_id) ?? 'Member',
        role: m.role,
        joinedAt: m.joined_at.toISOString(),
      })),
      messages: messageRows.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender_id ? nameById.get(m.sender_id) ?? null : null,
        text: m.text,
        isSystem: m.is_system,
        createdAt: m.created_at.toISOString(),
      })),
    };
  }
}
