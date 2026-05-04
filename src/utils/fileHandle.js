import fs from 'fs/promises';
import path from 'path';

const mimeMap = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * 读取本地或远程图片并转为 base64
 * @param {string} imagePath - 本地文件路径或图片 URL
 * @returns {Promise<string>} dataURL 格式: data:image/png;base64,...
 */
export async function imageToBase64(imagePath) {
  let buffer;
  let mimeType;

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    const res = await fetch(imagePath);
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
    mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || getMimeType(imagePath);
  } else {
    const absPath = path.resolve(imagePath);
    buffer = await fs.readFile(absPath);
    mimeType = getMimeType(absPath);
  }

  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
