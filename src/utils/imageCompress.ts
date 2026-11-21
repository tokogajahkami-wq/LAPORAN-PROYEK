export interface CompressedImage {
  dataUrl: string;
  mimeType: string;
  sizeKb: number;
}

export async function compressReceiptImage(
  file: File,
  maxDimension = 1200,
  quality = 0.72
): Promise<CompressedImage> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Format gambar tidak didukung atau rusak.'));
    image.src = rawDataUrl;
  });

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      dataUrl: rawDataUrl,
      mimeType: file.type || 'image/jpeg',
      sizeKb: Math.round((rawDataUrl.length * 3) / 4 / 1024),
    };
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let compressedUrl = canvas.toDataURL('image/jpeg', quality);
  if (compressedUrl.length > 330000) {
    compressedUrl = canvas.toDataURL('image/jpeg', 0.52);
  }
  return {
    dataUrl: compressedUrl,
    mimeType: 'image/jpeg',
    sizeKb: Math.round((compressedUrl.length * 3) / 4 / 1024),
  };
}
