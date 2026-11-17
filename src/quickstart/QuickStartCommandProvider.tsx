import type { FC, ReactNode } from 'react';
import { QuickStartCommandBridge } from './QuickStartCommandBridge';

export const useQuickStartCommandBridgeValue = (): undefined => undefined;

export const QuickStartCommandProvider: FC<{
  children?: ReactNode;
  value?: unknown;
}> = ({ children }) => {
  return (
    <>
      <QuickStartCommandBridge />
      {children}
    </>
  );
};
