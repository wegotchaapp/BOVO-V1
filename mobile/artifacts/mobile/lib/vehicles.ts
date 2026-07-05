import { apiClient } from "./api";

export interface Vehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  state: string;
  vin: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertVehicleInput {
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  state?: string;
  vin?: string;
}

export async function listMyVehicles(): Promise<Vehicle[]> {
  const data = await apiClient.get<{ vehicles: Vehicle[] }>("/vehicles/mine");
  return data.vehicles;
}

export async function upsertVehicle(
  input: UpsertVehicleInput,
): Promise<Vehicle> {
  const data = await apiClient.post<{ vehicle: Vehicle }>("/vehicles", input);
  return data.vehicle;
}
