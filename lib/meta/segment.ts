import { decodeMaskToRaster, parseImageStream, recordsOfKind, type SegmentationMaskRecord } from '@meta-sam/parser';
import sharp from 'sharp';
import { SAM_MODEL, samStreamEvent } from './config';

export type Cutout = { subjectUrl: string; backgroundUrl: string };

/** Upload a rendered PNG and get a stable URL back. */
export type PersistPng = (png: Buffer, suffix: string) => Promise<string>;

/**
 * Runs SAM 3.1 on one image with a concept prompt ("red sneaker") and composites
 * a transparent subject cutout plus a blurred backdrop. Throws when nothing matches;
 * callers treat that as "keep the plain image".
 */
export async function segmentImage(imageUrl: string, concept: string, persist: PersistPng): Promise<Cutout> {
  const events = samStreamEvent({
    model: SAM_MODEL,
    input: [
      {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_text', text: concept },
          { type: 'input_image', image_url: imageUrl },
        ],
      },
    ],
    metadata: { mask_encoding: 'one_bit' },
  });

  const parsed = parseImageStream(events as AsyncGenerator<{ type: string }>);
  const result = await parsed.finalResult;

  const masks = recordsOfKind(result.records, 'mask') as SegmentationMaskRecord[];
  if (masks.length === 0) throw new Error(`Nothing to cut out for "${concept}"`);
  // Biggest mask = the main subject.
  const best = masks.reduce((a, b) => (area(b) >= area(a) ? b : a));

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Could not load the generated visual (${imgRes.status}).`);
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
  const info = await sharp(imgBuf).metadata();
  if (!info.width || !info.height) throw new Error('Generated visual has no size.');
  const { width, height } = info;

  // The mask raster is smaller than the source and positioned at the record's bounds.
  // Stretch it to the bounds box on a zero canvas, giving a full-size single-channel alpha.
  const raster = decodeMaskToRaster(best.mask);
  const bw = best.bounds.right - best.bounds.left;
  const bh = best.bounds.bottom - best.bounds.top;
  const patch = await sharp(raster as Buffer, {
    raw: { width: best.mask.width, height: best.mask.height, channels: 1 },
  })
    .resize(bw, bh, { fit: 'fill' })
    // raster values are 0/1; alpha needs 0/255
    .linear(255, 0)
    .toColourspace('b-w')
    .raw()
    .toBuffer();
  const alpha = await sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: patch, raw: { width: bw, height: bh, channels: 1 }, left: best.bounds.left, top: best.bounds.top }])
    .extractChannel(0)
    .raw()
    .toBuffer();

  // Subject: original pixels with the mask as the alpha channel.
  const subject = await sharp(imgBuf).joinChannel(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();

  // Background: the image with the subject region heavily blurred (a cheap inpaint).
  const blurredMasked = await sharp(imgBuf)
    .blur(45)
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  const background = await sharp(imgBuf).composite([{ input: blurredMasked }]).png().toBuffer();

  const [subjectUrl, backgroundUrl] = await Promise.all([
    persist(subject, 'subject.png'),
    persist(background, 'background.png'),
  ]);
  return { subjectUrl, backgroundUrl };
}

function area(m: SegmentationMaskRecord): number {
  return Math.max(0, m.bounds.right - m.bounds.left) * Math.max(0, m.bounds.bottom - m.bounds.top);
}
