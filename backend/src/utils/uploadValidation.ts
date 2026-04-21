import fs from 'fs/promises';

const JPEG_HEADER = [0xff, 0xd8, 0xff];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF87A = 'GIF87a';
const GIF89A = 'GIF89a';
const RIFF = 'RIFF';
const WEBP = 'WEBP';
const FTYP = 'ftyp';
const WEBM_HEADER = [0x1a, 0x45, 0xdf, 0xa3];
const ICO_HEADER = [0x00, 0x00, 0x01, 0x00];

const headerMatches = (buffer: Buffer, signature: number[]) =>
  signature.every((byte, index) => buffer[index] === byte);

const isJpeg = (buffer: Buffer) => headerMatches(buffer, JPEG_HEADER);
const isPng = (buffer: Buffer) => headerMatches(buffer, PNG_HEADER);
const isGif = (buffer: Buffer) => {
  const header = buffer.subarray(0, 6).toString('ascii');
  return header === GIF87A || header === GIF89A;
};
const isWebp = (buffer: Buffer) =>
  buffer.subarray(0, 4).toString('ascii') === RIFF
  && buffer.subarray(8, 12).toString('ascii') === WEBP;
const isIco = (buffer: Buffer) => headerMatches(buffer, ICO_HEADER);
const isWebm = (buffer: Buffer) => headerMatches(buffer, WEBM_HEADER);
const isIsoBaseMedia = (buffer: Buffer) => buffer.subarray(4, 8).toString('ascii') === FTYP;

const isBufferAllowedForMime = (buffer: Buffer, mimetype: string) => {
  switch (mimetype) {
    case 'image/jpeg':
    case 'image/jpg':
      return isJpeg(buffer);
    case 'image/png':
      return isPng(buffer);
    case 'image/gif':
      return isGif(buffer);
    case 'image/webp':
      return isWebp(buffer);
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return isIco(buffer);
    case 'video/webm':
      return isWebm(buffer);
    case 'video/mp4':
    case 'video/quicktime':
    case 'video/x-m4v':
      return isIsoBaseMedia(buffer);
    default:
      return false;
  }
};

export const ensureStoredFileMatchesMimeSignature = async (filePath: string, mimetype: string) => {
  const fileHandle = await fs.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, 0);
    return isBufferAllowedForMime(buffer.subarray(0, bytesRead), String(mimetype || '').toLowerCase());
  } finally {
    await fileHandle.close();
  }
};

export const deleteStoredFiles = async (filePaths: string[]) => {
  await Promise.all(filePaths.map(async (filePath) => {
    try {
      await fs.unlink(filePath);
    } catch {}
  }));
};
