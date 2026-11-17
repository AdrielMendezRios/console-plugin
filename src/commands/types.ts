import type { TFunction } from 'react-i18next';

export type CommandStatus = 'idle' | 'running' | 'success' | 'error';

export interface CommandResult {
  status: CommandStatus;
  message?: string;
  detail?: string;
}

export type CommandActionParams = Record<string, string>;

export interface CommandActionRequest {
  action: string;
  params?: CommandActionParams;
}

export interface CommandActionContext {
  namespace: string;
  t: TFunction<'plugin__partner-labs-console-plugin'>;
}
