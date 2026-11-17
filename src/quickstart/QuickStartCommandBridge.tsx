import { useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  Content,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  TextInput,
  Tooltip,
} from '@patternfly/react-core';
import { useCallback, useEffect, useState, type FC } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { commandNeedsProject, runCommandAction } from '../commands/actions';
import { CommandResultView } from '../commands/CommandResultView';
import { getQuickStartCommandAction } from '../commands/quickstartCommands';
import { getCommandRisk, isQuickStartCommandAction } from '../commands/supportedActions';
import type { CommandActionRequest, CommandResult } from '../commands/types';
import './quickstart-command-bridge.css';

const PANEL_SELECTOR = '[data-test="quickstart drawer"], .pfext-quick-start-panel-content__body';

interface BridgeTarget {
  id: string;
  actionContainer: HTMLElement;
  resultContainer: HTMLElement;
  request: CommandActionRequest;
}

let nextTargetId = 0;

function collectTargets(): BridgeTarget[] {
  if (!document.querySelector(PANEL_SELECTOR)) return [];
  const targets: BridgeTarget[] = [];
  document
    .querySelectorAll<HTMLElement>(`:is(${PANEL_SELECTOR}) .pf-v6-c-code-block`)
    .forEach((block) => {
      const command = block.querySelector('code')?.textContent ?? '';
      const request = getQuickStartCommandAction(command);
      if (!request || !isQuickStartCommandAction(request.action)) return;

      const actions = block.querySelector<HTMLElement>('.pf-v6-c-code-block__actions');
      if (!actions) return;

      let actionContainer = block.querySelector<HTMLElement>('[data-partner-labs-run]');
      const id = actionContainer?.dataset.partnerLabsRun ?? `qs-command-${String(++nextTargetId)}`;
      if (!actionContainer) {
        actionContainer = document.createElement('div');
        actionContainer.className =
          'pf-v6-c-code-block__actions-item partner-labs-console-plugin__quickstart-command-action';
        actionContainer.dataset.partnerLabsRun = id;
        actions.append(actionContainer);
      }
      block.querySelectorAll<HTMLElement>('[data-partner-labs-run]').forEach((element) => {
        if (element !== actionContainer) element.remove();
      });

      let resultContainer = document.querySelector<HTMLElement>(
        `[data-partner-labs-result="${id}"]`,
      );
      document
        .querySelectorAll<HTMLElement>(`[data-partner-labs-result="${id}"]`)
        .forEach((element) => {
          if (element !== resultContainer) element.remove();
        });
      if (!resultContainer) {
        resultContainer = document.createElement('div');
        resultContainer.className = 'partner-labs-console-plugin__quickstart-command-result';
        resultContainer.dataset.partnerLabsResult = id;
        block.insertAdjacentElement('afterend', resultContainer);
      }

      targets.push({ id, actionContainer, resultContainer, request });
    });
  return targets;
}

function sameTargets(left: BridgeTarget[], right: BridgeTarget[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (target, index) =>
        target.id === right[index].id &&
        target.request.action === right[index].request.action &&
        JSON.stringify(target.request.params) === JSON.stringify(right[index].request.params),
    )
  );
}

const QuickStartCommandRunner: FC<{
  target: BridgeTarget;
  result: CommandResult;
  onResult: (result: CommandResult) => void;
}> = ({ target, result, onResult }) => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const [namespace] = useActiveNamespace();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const needsProject = commandNeedsProject(target.request.action, namespace, target.request.params);
  const risk = getCommandRisk(target.request.action);
  const namespaceToDelete = target.request.params?.name;
  const confirmationId = `quickstart-delete-confirmation-${target.id}`;

  const runAction = useCallback(async () => {
    if (needsProject) return;
    onResult({ status: 'running' });
    try {
      const output = await runCommandAction(target.request, { namespace, t });
      onResult({ status: 'success', ...output });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onResult({ status: 'error', message });
    }
  }, [needsProject, namespace, onResult, t, target.request]);

  const handleRun = useCallback(() => {
    if (risk === 'delete') {
      setConfirmation('');
      setConfirmOpen(true);
      return;
    }
    void runAction();
  }, [risk, runAction]);

  const handleConfirmDelete = useCallback(() => {
    if (confirmation !== namespaceToDelete) return;
    setConfirmOpen(false);
    void runAction();
  }, [confirmation, namespaceToDelete, runAction]);

  if (!target.actionContainer.isConnected || !target.resultContainer.isConnected) return null;

  const button = (
    <Button
      variant="link"
      onClick={handleRun}
      isDisabled={result.status === 'running' || needsProject}
      isLoading={result.status === 'running'}
      data-test="quickstart-run-command"
    >
      {t('Run')}
    </Button>
  );

  return (
    <>
      {createPortal(
        needsProject ? (
          <Tooltip content={t('Select a project first')}>
            <span aria-label={t('Select a project first')}>{button}</span>
          </Tooltip>
        ) : (
          button
        ),
        target.actionContainer,
      )}
      {createPortal(
        <CommandResultView result={result} dataTest="quickstart-command-output" />,
        target.resultContainer,
      )}
      {risk === 'delete' && namespaceToDelete && (
        <Modal
          variant={ModalVariant.small}
          isOpen={confirmOpen}
          data-test="quickstart-delete-modal"
          onClose={() => {
            setConfirmOpen(false);
          }}
        >
          <ModalHeader title={t('Delete demo namespace?')} />
          <ModalBody>
            <Content component="p">
              {t(
                'This permanently deletes namespace "{{name}}" and every resource in it. This cannot be undone.',
                { name: namespaceToDelete },
              )}
            </Content>
            <FormGroup label={t('Type the namespace name to confirm')} fieldId={confirmationId}>
              <TextInput
                id={confirmationId}
                value={confirmation}
                onChange={(_event, value) => {
                  setConfirmation(value);
                }}
                data-test="quickstart-delete-confirmation"
              />
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isDisabled={confirmation !== namespaceToDelete}
              data-test="quickstart-confirm-delete"
            >
              {t('Delete namespace')}
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setConfirmOpen(false);
              }}
              data-test="quickstart-cancel-delete"
            >
              {t('Cancel')}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
};

export const QuickStartCommandBridge: FC = () => {
  const [targets, setTargets] = useState<BridgeTarget[]>([]);
  const [results, setResults] = useState<Record<string, CommandResult>>({});

  useEffect(() => {
    let timer: number | undefined;
    const scan = () => {
      timer = undefined;
      const next = collectTargets();
      setTargets((previous) => (sameTargets(previous, next) ? previous : next));
    };
    const schedule = () => {
      timer ??= window.setTimeout(scan, 100);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const active = new Set(targets.map((target) => target.id));
    document
      .querySelectorAll<HTMLElement>('[data-partner-labs-run], [data-partner-labs-result]')
      .forEach((element) => {
        const id = element.dataset.partnerLabsRun ?? element.dataset.partnerLabsResult;
        if (!id || !active.has(id)) element.remove();
      });
  }, [targets]);

  const setResult = useCallback((id: string, result: CommandResult) => {
    setResults((previous) => ({ ...previous, [id]: result }));
  }, []);

  return (
    <>
      {targets.map((target) => (
        <QuickStartCommandRunner
          key={target.id}
          target={target}
          result={results[target.id] ?? { status: 'idle' }}
          onResult={(result) => {
            setResult(target.id, result);
          }}
        />
      ))}
    </>
  );
};
