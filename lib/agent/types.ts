import type { UIMessage } from 'ai';

export type StepStatus = 'running' | 'done' | 'error';

export type AgentEvent =
  | { type: 'step'; id: string; label: string; status: StepStatus; detail?: string }
  | { type: 'version'; artifactId: string; version: number }
  | { type: 'error'; message: string }
  | { type: 'done' };

/** Payload of a `data-step` part: one live-updating agent activity row. */
export type AgentStepData = {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
};

/** Payload of a `data-version` part: a storyboard version was saved to the board. */
export type AgentVersionData = {
  artifactId: string;
  version: number;
};

export type AgentDataParts = {
  step: AgentStepData;
  version: AgentVersionData;
};

/** The chat message type shared by the agent endpoint and the sidebar. */
export type AgentUIMessage = UIMessage<unknown, AgentDataParts>;
