/**
 * Comprime uma foto para guardar no aparelho: lado maior até 1280px, JPEG ~72%.
 * Uma foto de celular de 3–5 MB vira algo entre 100 e 250 KB.
 */
export interface CompressedImage { dataUrl: string; width: number; height: number; bytes: number }

async function load(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); } catch { /* tenta pelo <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

export async function compressImage(file: Blob, maxSide = 1280, quality = 0.72): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) throw new Error('O arquivo escolhido não é uma imagem.');
  let img;
  try { img = await load(file); } catch { throw new Error('Não consegui abrir esta foto. Tente tirar a foto pelo app ou escolher outra imagem (JPG ou PNG).'); }
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const bytes = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
  return { dataUrl, width, height, bytes };
}
