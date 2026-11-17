import { CodeBlock, CodeBlockCode, ExpandableSection, Label } from '@patternfly/react-core';
import { useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandResult } from './types';

export const CommandResultView: FC<{
  result: CommandResult;
  dataTest?: string;
  className?: string;
}> = ({ result, dataTest = 'command-output', className }) => {
  const { t } = useTranslation('plugin__partner-labs-console-plugin');
  const [dismissedDetail, setDismissedDetail] = useState<string>();
  const expanded = Boolean(result.detail) && dismissedDetail !== result.detail;

  return (
    <div className={className}>
      {result.status !== 'idle' && result.message && (
        <Label
          status={
            result.status === 'error' ? 'danger' : result.status === 'success' ? 'success' : 'info'
          }
          className="partner-labs-console-plugin__command-result"
          data-test={`${dataTest}-result`}
        >
          {result.message}
        </Label>
      )}
      {result.detail && (
        <ExpandableSection
          isExpanded={expanded}
          onToggle={(_event, isExpanded) => {
            setDismissedDetail(isExpanded ? undefined : result.detail);
          }}
          toggleText={t('Output')}
          data-test={dataTest}
        >
          <div className="partner-labs-console-plugin__command-detail">
            <CodeBlock>
              <CodeBlockCode>{result.detail}</CodeBlockCode>
            </CodeBlock>
          </div>
        </ExpandableSection>
      )}
    </div>
  );
};
