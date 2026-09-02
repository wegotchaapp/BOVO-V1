import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PinoLogger } from 'nestjs-pino';
import {
  TripGroup,
  TripGroupMember,
  TripGroupMessage,
  TripGroupPickupApproval,
} from '../../database/entities/trip-group.entity';
import { Booking } from '../../database/entities/booking.entities';

@Injectable()
export class TripGroupsService {
  constructor(
    @InjectRepository(TripGroup)
    private readonly groupRepo: Repository<TripGroup>,
    @InjectRepository(TripGroupMember)
    private readonly memberRepo: Repository<TripGroupMember>,
    @InjectRepository(TripGroupMessage)
    private readonly messageRepo: Repository<TripGroupMessage>,
    @InjectRepository(TripGroupPickupApproval)
    private readonly approvalRepo: Repository<TripGroupPickupApproval>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly logger: PinoLogger,
  ) {}

  async getGroupByTripId(tripId: string): Promise<TripGroup> {
    const group = await this.groupRepo.findOne({
      where: { trip_id: tripId },
      relations: ['members'],
    });
    if (!group) throw new NotFoundException('Trip group not found');
    return group;
  }

  async createGroup(tripId: string, driverId: string): Promise<TripGroup> {
    const existing = await this.groupRepo.findOne({
      where: { trip_id: tripId },
    });
    if (existing)
      throw new BadRequestException('Group already exists for this trip');

    const group = this.groupRepo.create({
      id: uuidv4().replace(/-/g, '').substring(0, 32),
      trip_id: tripId,
    });
    const saved = await this.groupRepo.save(group);

    await this.memberRepo.save(
      this.memberRepo.create({
        id: uuidv4().replace(/-/g, '').substring(0, 32),
        group_id: saved.id,
        user_id: driverId,
        role: 'driver',
      }),
    );

    this.logger.info(
      { groupId: saved.id, tripId, driverId },
      'Trip group created',
    );
    return saved;
  }

  async joinGroup(
    groupId: string,
    userId: string,
    role: string,
  ): Promise<TripGroupMember> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Trip group not found');

    const existing = await this.memberRepo.findOne({
      where: { group_id: groupId, user_id: userId },
    });
    if (existing)
      throw new BadRequestException('User already a member of this group');

    if (!['driver', 'rider'].includes(role)) {
      throw new BadRequestException('Role must be driver or rider');
    }

    const member = this.memberRepo.create({
      id: uuidv4().replace(/-/g, '').substring(0, 32),
      group_id: groupId,
      user_id: userId,
      role,
    });

    return this.memberRepo.save(member);
  }

  async sendMessage(
    groupId: string,
    senderId: string | null,
    text: string,
    isSystem: boolean,
  ): Promise<TripGroupMessage> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Trip group not found');

    const message = this.messageRepo.create({
      id: uuidv4().replace(/-/g, '').substring(0, 32),
      group_id: groupId,
      sender_id: senderId,
      text,
      is_system: isSystem,
    });

    return this.messageRepo.save(message);
  }

  async votePickupHub(
    groupId: string,
    userId: string,
    hubId: string,
  ): Promise<{ locked: boolean; pickup_hub_id: string | null }> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Trip group not found');

    if (group.pickup_locked) {
      return { locked: true, pickup_hub_id: group.pickup_hub_id };
    }

    const existing = await this.approvalRepo.findOne({
      where: { group_id: groupId, user_id: userId },
    });

    if (existing) {
      existing.hub_id = hubId;
      await this.approvalRepo.save(existing);
    } else {
      const approval = this.approvalRepo.create({
        id: uuidv4().replace(/-/g, '').substring(0, 32),
        group_id: groupId,
        user_id: userId,
        hub_id: hubId,
      });
      await this.approvalRepo.save(approval);
    }

    const approvals = await this.approvalRepo.find({
      where: { group_id: groupId },
    });
    const memberCount = await this.memberRepo.count({
      where: { group_id: groupId },
    });
    const majority = Math.floor(memberCount / 2) + 1;

    const voteCounts: Record<string, number> = {};
    for (const a of approvals) {
      voteCounts[a.hub_id] = (voteCounts[a.hub_id] || 0) + 1;
    }

    for (const [hub, count] of Object.entries(voteCounts)) {
      if (count >= majority) {
        group.pickup_hub_id = hub;
        group.pickup_locked = true;
        await this.groupRepo.save(group);

        this.logger.info(
          { groupId, hub, votes: count, majority },
          'Pickup hub locked by majority vote',
        );
        return { locked: true, pickup_hub_id: hub };
      }
    }

    return { locked: false, pickup_hub_id: null };
  }

  async getPickupHubStatus(groupId: string): Promise<{
    pickup_hub_id: string | null;
    pickup_locked: boolean;
    votes: { user_id: string; hub_id: string }[];
  }> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Trip group not found');

    const approvals = await this.approvalRepo.find({
      where: { group_id: groupId },
    });
    const votes = approvals.map((a) => ({
      user_id: a.user_id,
      hub_id: a.hub_id,
    }));

    return {
      pickup_hub_id: group.pickup_hub_id,
      pickup_locked: group.pickup_locked,
      votes,
    };
  }

  async getMessages(
    groupId: string,
    limit?: number,
  ): Promise<TripGroupMessage[]> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Trip group not found');

    const take = limit || 50;

    return this.messageRepo.find({
      where: { group_id: groupId },
      order: { created_at: 'DESC' },
      take,
    });
  }
}
