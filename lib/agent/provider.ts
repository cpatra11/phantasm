import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { META_API_KEY, META_BASE_URL, SPARK_MODEL } from '../meta/config';

/**
 * The Meta Model API as a Vercel AI SDK provider.
 * Tool-calling on muse-spark-1.3 verified live (finish_reason: 'tool_calls').
 */
const metaProvider = createOpenAICompatible({
  name: 'meta',
  baseURL: META_BASE_URL.replace(/\/$/, ''),
  apiKey: META_API_KEY,
});

/** The loop driver: Spark plans which tools to call and in what order. */
export function sparkModel() {
  return metaProvider.chatModel(SPARK_MODEL);
}
