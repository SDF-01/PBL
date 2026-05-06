import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function validateImage(file: File): void {
  if (!file.type.startsWith("image/")) throw new Error("File must be an image.");
  if (file.size > MAX_BYTES) throw new Error("Image must be smaller than 5 MB.");
}

function ext(file: File): string {
  const m = file.name.match(/\.([^.]+)$/);
  return m ? `.${(m[1] ?? "").toLowerCase()}` : "";
}

export async function uploadPlayerPhoto(uid: string, file: File): Promise<string> {
  validateImage(file);
  const path = `players/${uid}/photo${ext(file)}`;
  const snap = await uploadBytes(ref(storage(), path), file, {
    contentType: file.type,
    cacheControl: "public, max-age=86400",
  });
  return getDownloadURL(snap.ref);
}

export async function uploadClubLogo(clubId: string, file: File): Promise<string> {
  validateImage(file);
  const path = `clubs/${clubId}/logo${ext(file)}`;
  const snap = await uploadBytes(ref(storage(), path), file, {
    contentType: file.type,
    cacheControl: "public, max-age=86400",
  });
  return getDownloadURL(snap.ref);
}

/** Used during club creation before a clubId exists — stored at a user-scoped temp path. */
export async function uploadPendingClubLogo(userId: string, file: File): Promise<string> {
  validateImage(file);
  const path = `clubs/pending/${userId}/logo${ext(file)}`;
  const snap = await uploadBytes(ref(storage(), path), file, {
    contentType: file.type,
    cacheControl: "public, max-age=86400",
  });
  return getDownloadURL(snap.ref);
}
