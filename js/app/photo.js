// Finish photos: shrunk on the phone to a JPEG under 1 MB, kept in the private
// "photos" bucket at photos/<user id>/<race id>.jpg. Only the runner can open them.
import { sb } from './supa.js';

export const PHOTO_MAX_MB = 10;

export async function compressPhoto(file, maxSide = 1600) {
  if (!file.type.startsWith('image/')) throw new Error('not-image');
  if (file.size > PHOTO_MAX_MB * 1024 * 1024) throw new Error('too-big');
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) throw new Error('not-image');
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * k);
  canvas.height = Math.round(img.height * k);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const q of [0.82, 0.72, 0.6, 0.5]) {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size < 950 * 1024) return blob;
  }
  throw new Error('too-big');
}

export const photoError = (e) => (e.message === 'too-big'
  ? `This photo is too large. Pick one under ${PHOTO_MAX_MB} MB.`
  : 'This file is not a photo. Pick a JPG or PNG.');

export async function uploadPhoto(uid, raceId, blob) {
  const path = `${uid}/${raceId}.jpg`;
  const { error } = await sb.storage.from('photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function photoUrl(path) {
  if (!path) return null;
  const { data } = await sb.storage.from('photos').createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}

export const removePhoto = (path) => (path ? sb.storage.from('photos').remove([path]) : null);

// Blob → data URL, so a check-in made without signal can keep its photo.
export const toDataUrl = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
export const fromDataUrl = (url) => fetch(url).then((res) => res.blob());
