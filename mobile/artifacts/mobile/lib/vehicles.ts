import { apiClient } from "./api";

export type PhotoSlot = "front" | "rear" | "left" | "right" | "interior";
export type DocKind = "insurance" | "registration";
export type VerificationStatus =
  | "incomplete"
  | "pending_review"
  | "approved"
  | "rejected";

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

export interface UpsertVehicleInput {
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

export async function listMyVehicles(): Promise<Vehicle[]> {
  const data = await apiClient.get<{ vehicles: Vehicle[] }>("/vehicles/mine");
  return data.vehicles;
}

export async function upsertVehicle(input: UpsertVehicleInput): Promise<Vehicle> {
  const data = await apiClient.post<{ vehicle: Vehicle }>("/vehicles", input);
  return data.vehicle;
}

function fileFormPart(uri: string, fallbackName: string) {
  const name = uri.split("/").pop() || fallbackName;
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "jpg";
  const mimeByExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    webp: "image/webp",
    pdf: "application/pdf",
  };
  return { uri, name, type: mimeByExt[ext] ?? "image/jpeg" } as unknown as Blob;
}

export async function uploadVehiclePhoto(
  slot: PhotoSlot,
  photoUri: string,
): Promise<Vehicle> {
  const form = new FormData();
  form.append("photo", fileFormPart(photoUri, `${slot}.jpg`));
  form.append("slot", slot);
  const data = await apiClient.postForm<{ vehicle: Vehicle }>("/vehicles/photo", form);
  return data.vehicle;
}

export async function uploadVehicleDocument(
  kind: DocKind,
  fileUri: string,
  expiresAt?: string,
): Promise<Vehicle> {
  const form = new FormData();
  form.append("document", fileFormPart(fileUri, `${kind}.jpg`));
  form.append("kind", kind);
  if (expiresAt) form.append("expiresAt", expiresAt);
  const data = await apiClient.postForm<{ vehicle: Vehicle }>("/vehicles/document", form);
  return data.vehicle;
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
