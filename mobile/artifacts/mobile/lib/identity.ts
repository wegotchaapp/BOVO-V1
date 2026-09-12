import { apiClient } from "./api";
import { appendFilePart } from "./upload";

/**
 * Government ID + selfie verification. A person on the Bovogo team reviews each
 * submission in the admin dashboard; approval sets the user's `isVerified`.
 */

export type IdDocumentType = "drivers_license" | "state_id" | "passport";
export type IdentityStatus = "pending_review" | "approved" | "rejected";

export interface IdentityVerification {
  id: string;
  status: IdentityStatus;
  documentType: IdDocumentType;
  submittedAt: string;
  reviewedAt: string | null;
  /** Why a submission was rejected. Null otherwise. */
  reviewNote: string | null;
}

export const ID_DOCUMENT_TYPES: { type: IdDocumentType; label: string }[] = [
  { type: "drivers_license", label: "Driver's license" },
  { type: "state_id", label: "State ID" },
  { type: "passport", label: "Passport" },
];

/** Passports have no back, so only the other two ask for one. */
export function needsBackImage(type: IdDocumentType): boolean {
  return type !== "passport";
}

/** The latest submission, or null if the user has never submitted. */
export async function getIdentityVerification(): Promise<IdentityVerification | null> {
  const data = await apiClient.get<{ verification: IdentityVerification | null }>(
    "/identity/verification",
  );
  return data.verification;
}

export async function submitIdentityVerification(input: {
  documentType: IdDocumentType;
  idFrontUri: string;
  idBackUri: string | null;
  selfieUri: string;
}): Promise<IdentityVerification> {
  const form = new FormData();
  form.append("documentType", input.documentType);
  await appendFilePart(form, "idFront", input.idFrontUri, "id-front.jpg");
  if (input.idBackUri && needsBackImage(input.documentType)) {
    await appendFilePart(form, "idBack", input.idBackUri, "id-back.jpg");
  }
  await appendFilePart(form, "selfie", input.selfieUri, "selfie.jpg");
  const data = await apiClient.postForm<{ verification: IdentityVerification }>(
    "/identity/verification",
    form,
  );
  return data.verification;
}
