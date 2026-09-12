import { Platform } from "react-native";

/**
 * Multipart file parts. React Native's `FormData` takes `{ uri, name, type }`
 * and reads the file itself; the web's takes a real `Blob`. Appending the
 * native object on web serialises it as the string `[object Object]`, so the
 * server receives a text field instead of a file — use `appendFilePart`, which
 * picks the right one for the platform.
 */

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  webp: "image/webp",
  pdf: "application/pdf",
};

function describe(uri: string, fallbackName: string) {
  // A web picker hands back `blob:`/`data:` URIs with no filename in them.
  const last = uri.split("?")[0].split("/").pop() || "";
  const name = last.includes(".") ? last : fallbackName;
  const ext = name.split(".").pop()!.toLowerCase();
  return { name, type: MIME_BY_EXT[ext] ?? "image/jpeg" };
}

/**
 * Appends a picked file under `field`. On web the URI is read into a `Blob`
 * first, so the request carries the selected bytes; on native the URI is passed
 * through untouched and the platform streams the file.
 */
export async function appendFilePart(
  form: FormData,
  field: string,
  uri: string,
  fallbackName: string,
): Promise<void> {
  const { name, type } = describe(uri, fallbackName);
  if (Platform.OS !== "web") {
    form.append(field, { uri, name, type } as unknown as Blob);
    return;
  }
  const res = await fetch(uri);
  if (!res.ok) throw new Error("That file couldn't be read. Please pick it again.");
  const blob = await res.blob();
  if (blob.size === 0) throw new Error("That file is empty. Please pick it again.");
  // `slice` retypes without copying when the picker gave us no content type.
  form.append(field, blob.type ? blob : blob.slice(0, blob.size, type), name);
}
