import { apiClient } from "./api";
import { appendFilePart } from "./upload";

export type PhotoSlot = "front" | "rear" | "left" | "right" | "interior";
export type DocKind = "insurance" | "registration";
export type VerificationStatus =
  | "incomplete"
  | "pending_review"
  | "approved"
  | "rejected";

/** Mirrors the server's cap. */
export const MAX_VEHICLES = 5;

/** The five required angles, in the order the Voyager is asked for them. */
export const PHOTO_SLOTS: { slot: PhotoSlot; label: string; hint: string }[] = [
  { slot: "front", label: "Front", hint: "Whole front of the car, plate visible" },
  { slot: "rear", label: "Rear", hint: "Whole back of the car, plate visible" },
  { slot: "left", label: "Driver's side", hint: "Full side profile" },
  { slot: "right", label: "Passenger's side", hint: "Full side profile" },
  { slot: "interior", label: "Interior", hint: "Seats and floor, from a front door" },
];

export interface Vehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  state: string;
  vin: string | null;
  seatCount: number | null;
  doorCount: number | null;
  photos: Record<PhotoSlot, string | null>;
  documents: Record<DocKind, { url: string | null; expiresAt: string | null }>;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  /** Plain-English list of what's still outstanding. Empty means ready. */
  missingRequirements: string[];
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleDetailsInput {
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  state?: string;
  /** Required — 17 characters, never containing I, O or Q. */
  vin: string;
  seatCount: number;
  doorCount: number;
  insuranceExpiresAt?: string;
  registrationExpiresAt?: string;
}

/** Newest first. */
export async function listMyVehicles(): Promise<Vehicle[]> {
  const data = await apiClient.get<{ vehicles: Vehicle[] }>("/vehicles/mine");
  return data.vehicles;
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const data = await apiClient.get<{ vehicle: Vehicle }>(`/vehicles/${id}`);
  return data.vehicle;
}

/** Registers another vehicle. Each one is reviewed on its own. */
export async function createVehicle(input: VehicleDetailsInput): Promise<Vehicle> {
  const data = await apiClient.post<{ vehicle: Vehicle }>("/vehicles", input);
  return data.vehicle;
}

/** Only vehicles that aren't approved yet can be changed. */
export async function updateVehicle(id: string, input: VehicleDetailsInput): Promise<Vehicle> {
  const data = await apiClient.put<{ vehicle: Vehicle }>(`/vehicles/${id}`, input);
  return data.vehicle;
}

export async function uploadVehiclePhoto(
  vehicleId: string,
  slot: PhotoSlot,
  photoUri: string,
): Promise<Vehicle> {
  const form = new FormData();
  await appendFilePart(form, "photo", photoUri, `${slot}.jpg`);
  form.append("slot", slot);
  const data = await apiClient.postForm<{ vehicle: Vehicle }>(`/vehicles/${vehicleId}/photo`, form);
  return data.vehicle;
}

export async function uploadVehicleDocument(
  vehicleId: string,
  kind: DocKind,
  fileUri: string,
  expiresAt?: string,
): Promise<Vehicle> {
  const form = new FormData();
  await appendFilePart(form, "document", fileUri, `${kind}.jpg`);
  form.append("kind", kind);
  if (expiresAt) form.append("expiresAt", expiresAt);
  const data = await apiClient.postForm<{ vehicle: Vehicle }>(`/vehicles/${vehicleId}/document`, form);
  return data.vehicle;
}

/** "Silver Toyota Camry" — what a Sailor looks for at the kerb. */
export function describeVehicle(v: Pick<Vehicle, "color" | "make" | "model">): string {
  return [v.color, v.make, v.model].map((p) => (p ?? "").trim()).filter(Boolean).join(" ");
}

/** Approved and still complete: the only vehicles an adventure can be posted with. */
export function isReadyToDrive(v: Vehicle): boolean {
  return v.verificationStatus === "approved" && v.missingRequirements.length === 0;
}

/** Review state in the words the Voyager sees. */
export function vehicleStatusLabel(v: Vehicle): string {
  if (v.verificationStatus === "approved") return "Approved";
  if (v.verificationStatus === "rejected") return "Needs attention";
  const n = v.missingRequirements.length;
  if (n === 0) return "Under review";
  return `${n} item${n === 1 ? "" : "s"} still needed`;
}

// ─── Background check (Checkr) ────────────────────────────────────────────────

export type BackgroundCheckStatus =
  | "not_started"
  | "invitation_sent"
  | "pending"
  | "clear"
  | "consider"
  | "suspended";

export interface BackgroundCheck {
  status: BackgroundCheckStatus;
  ssnVerified: boolean;
  ssnLast4: string | null;
  completedAt: string | null;
  configured: boolean;
}

export async function getBackgroundCheck(): Promise<BackgroundCheck> {
  return apiClient.get<BackgroundCheck>("/background-check/status");
}

/**
 * Returns a Checkr-hosted URL where the Voyager enters their SSN and consent.
 * That data goes straight to Checkr — it never passes through Bovogo.
 */
export async function startBackgroundCheck(): Promise<{
  alreadyCleared: boolean;
  invitationUrl: string | null;
  status: BackgroundCheckStatus;
}> {
  return apiClient.post("/background-check/start", {});
}
