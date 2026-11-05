/**
 * One-time (and per-change) deploy of Remotion Lambda into your AWS account.
 *
 *   npm run deploy:remotion
 *
 * Needs AWS credentials in the environment (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, or a profile).
 * Prints the three variables to copy into .env.local.
 */
import path from 'node:path';
import { deployFunction, deploySite, getOrCreateBucket } from '@remotion/lambda';

type Region = Parameters<typeof deployFunction>[0]['region'];

async function main() {
  const region = (process.env.REMOTION_AWS_REGION ?? 'us-east-1') as Region;

  console.log(`Region: ${region}`);
  const { bucketName } = await getOrCreateBucket({ region });
  console.log(`Bucket: ${bucketName}`);

  const { serveUrl } = await deploySite({
    entryPoint: path.join(process.cwd(), 'remotion', 'index.ts'),
    bucketName,
    region,
    siteName: 'basix',
  });
  console.log(`Site deployed: ${serveUrl}`);

  const { functionName, alreadyExisted } = await deployFunction({
    region,
    timeoutInSeconds: 240,
    memorySizeInMb: 2048,
    createCloudWatchLogGroup: true,
  });
  console.log(`Function ${alreadyExisted ? 'already existed' : 'deployed'}: ${functionName}`);

  console.log('\nAdd these to .env.local:\n');
  console.log(`REMOTION_FUNCTION_NAME=${functionName}`);
  console.log(`REMOTION_SERVE_URL=${serveUrl}`);
  console.log(`REMOTION_AWS_REGION=${region}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
