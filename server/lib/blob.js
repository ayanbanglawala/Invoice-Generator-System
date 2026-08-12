import { put } from "@vercel/blob";

// Accepts a base64 data URL (e.g. "data:image/jpeg;base64,...") straight from
// the browser's canvas/FileReader, uploads it to Vercel Blob, and returns the
// public URL. Requires BLOB_READ_WRITE_TOKEN in the environment (Vercel sets
// this automatically once a Blob store is connected to the project; for
// local dev, copy it from Vercel -> Storage -> your Blob store -> .env.local tab).
export async function uploadParcelImage(dataUrl, dNumber) {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl || "");
  if (!match) {
    throw new Error("Invalid image data — expected a base64 data URL.");
  }
  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  const ext = contentType.split("/")[1] || "jpg";

  const blob = await put(`parcels/${dNumber}-${Date.now()}.${ext}`, buffer, {
    access: "public",
    contentType,
  });

  return blob.url;
}
