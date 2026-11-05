import { getRenderProgress, renderMediaOnLambda, renderStillOnLambda } from '@remotion/lambda/client';
import { firstSceneReadyFrame, type Aspect, type SceneDoc } from '../scenedoc';

type Region = Parameters<typeof renderMediaOnLambda>[0]['region'];

function config() {
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;
  const region = (process.env.REMOTION_AWS_REGION ?? 'us-east-1') as Region;
  if (!functionName || !serveUrl) {
    throw new Error('Remotion Lambda is not configured. Run `npm run deploy:remotion` and set REMOTION_FUNCTION_NAME and REMOTION_SERVE_URL.');
  }
  return { functionName, serveUrl, region };
}

export async function startVideoRender(doc: SceneDoc, aspect: Aspect) {
  const c = config();
  const r = await renderMediaOnLambda({
    ...c,
    composition: 'SceneDoc',
    inputProps: { doc, aspect },
    codec: 'h264',
    imageFormat: 'jpeg',
    privacy: 'public',
    maxRetries: 1,
  });
  return {
    remoteId: r.renderId,
    bucketName: r.bucketName,
    functionName: c.functionName,
    region: String(c.region),
  };
}

export async function videoStatus(r: { remoteId: string; bucketName: string; functionName: string; region: string }): Promise<{
  status: 'rendering' | 'done' | 'failed';
  url?: string;
  error?: string;
}> {
  const p = await getRenderProgress({
    renderId: r.remoteId,
    bucketName: r.bucketName,
    functionName: r.functionName,
    region: r.region as Region,
  });
  if (p.fatalErrorEncountered) return { status: 'failed', error: p.errors[0]?.message ?? 'Render failed' };
  if (p.done) return { status: 'done', url: p.outputFile ?? undefined };
  return { status: 'rendering' };
}

export async function startStillRender(doc: SceneDoc, aspect: Aspect): Promise<{ url: string }> {
  const c = config();
  const r = await renderStillOnLambda({
    ...c,
    composition: 'SceneDoc',
    inputProps: { doc, aspect },
    imageFormat: 'png',
    privacy: 'public',
    frame: firstSceneReadyFrame(doc),
  });
  return { url: r.url };
}
