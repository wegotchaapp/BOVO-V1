import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MobileVehicle } from '../entities/mobile.entities';
import { UpsertVehicleBody } from '../dto/mobile.dto';
import { vehicleToDto } from '../mobile.mappers';

@Injectable()
export class MobileVehiclesService {
  constructor(
    @InjectRepository(MobileVehicle)
    private readonly vehicles: Repository<MobileVehicle>,
  ) {}

  async mine(userId: string) {
    const rows = await this.vehicles.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
    });
    return { vehicles: rows.map(vehicleToDto) };
  }

  /** Upsert a single primary vehicle per user (MVP). */
  async upsert(userId: string, dto: UpsertVehicleBody) {
    const existing = await this.vehicles.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
      take: 1,
    });
    let row = existing[0];
    if (!row) {
      row = this.vehicles.create({ user_id: userId });
    }
    row.make = dto.make.trim();
    row.model = dto.model.trim();
    row.year = dto.year;
    row.color = dto.color.trim();
    row.license_plate = dto.licensePlate.trim().toUpperCase();
    row.state = (dto.state ?? 'TX').trim().toUpperCase().slice(0, 2);
    row.vin = dto.vin?.trim().toUpperCase() || null;
    const saved = await this.vehicles.save(row);
    return { vehicle: vehicleToDto(saved) };
  }

  async getOne(userId: string, id: string) {
    const row = await this.vehicles.findOne({ where: { id } });
    if (!row || row.user_id !== userId) {
      throw new NotFoundException('Vehicle not found');
    }
    return { vehicle: vehicleToDto(row) };
  }
}
