import {
  Button,
  ClipboardCopyButton,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  Label,
  Tooltip,
} from '@patternfly/react-core';
import { useCallback, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { commandNeedsProject, getCommandPlaceholders, runCommandAction } from '../commands/actions';
import { CommandResultView } from '../commands/CommandResultView';
import type { CommandResult } from '../commands/types';

export type { CommandResult } from '../commands/types';

let nextCopyId = 0;

export const CommandBlock: FC<{
  command: string;
  action?: string;
  namespace: string;
  onResult: (result: CommandResult) => void;
  result: CommandResult;
}> = ({ command, action, namespace, onResult, result }) => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const [copyId] = useState(() => `partner-labs-copy-${(++nextCopyId).toString()}`);
  const [copied, setCopied] = useState(false);
  const placeholders = getCommandPlaceholders(command);
  const needsProject = commandNeedsProject(action, namespace);

  const handleRun = useCallback(async () => {
    if (!action || needsProject) return;
    onResult({ status: 'running' });
    try {
      const output = await runCommandAction({ action }, { namespace, t });
      onResult({ status: 'success', ...output });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onResult({ status: 'error', message });
    }
  }, [action, namespace, needsProject, onResult, t]);

  const runButton = (
    <Button
      variant="link"
      onClick={() => void handleRun()}
      isDisabled={result.status === 'running' || needsProject}
      isLoading={result.status === 'running'}
      data-test="run-command"
    >
      {t('Run')}
    </Button>
  );

  return (
    <div className="partner-labs-console-plugin__command-block">
      <CodeBlock
        actions={
          <>
            <CodeBlockAction>
              {/* PF6 still requires the deprecated textId for associating copied content. */}
              {/* eslint-disable @typescript-eslint/no-deprecated */}
              <ClipboardCopyButton
                id={copyId}
                textId={`${copyId}-text`}
                exitDelay={2000}
                onTooltipHidden={() => {
                  setCopied(false);
                }}
                onClick={() => {
                  void navigator.clipboard.writeText(command).then(
                    () => {
                      setCopied(true);
                    },
                    () => {
                      setCopied(false);
                    },
                  );
                }}
                data-test="copy-command"
              >
                {copied ? t('Copied') : t('Copy command')}
              </ClipboardCopyButton>
              {/* eslint-enable @typescript-eslint/no-deprecated */}
            </CodeBlockAction>
            {action && placeholders.length === 0 && (
              <CodeBlockAction>
                {needsProject ? (
                  <Tooltip content={t('Select a project first')}>
                    <span>{runButton}</span>
                  </Tooltip>
                ) : (
                  runButton
                )}
              </CodeBlockAction>
            )}
          </>
        }
      >
        <CodeBlockCode id={`${copyId}-text`}>{command}</CodeBlockCode>
      </CodeBlock>
      {needsProject && <Label isCompact>{t('Select a project first')}</Label>}
      {placeholders.length > 0 && (
        <Tooltip content={t('Replace placeholders: {{names}}', { names: placeholders.join(', ') })}>
          <Label isCompact>{t('Edit before running')}</Label>
        </Tooltip>
      )}
      <CommandResultView result={result} />
    </div>
  );
};
