import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

// Entry point for both the in-app preview bundle and the Remotion Lambda site bundle.
registerRoot(RemotionRoot);
