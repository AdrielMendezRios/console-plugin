import { fireEvent, render, screen, waitFor } from '@testing-library/react';

let mockNamespace = 'demo';
const mockGet = jest.fn();
const mockListItems = jest.fn();
const mockDelete = jest.fn();
const mockPatch = jest.fn();

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useActiveNamespace: () => [mockNamespace],
  k8sCreate: jest.fn(),
  k8sDelete: (...args: unknown[]) => mockDelete(...args) as Promise<unknown>,
  k8sGet: (...args: unknown[]) => mockGet(...args) as Promise<unknown>,
  k8sListItems: (...args: unknown[]) => mockListItems(...args) as Promise<unknown[]>,
  k8sPatch: (...args: unknown[]) => mockPatch(...args) as Promise<unknown>,
}));

import { QuickStartCommandProvider } from './QuickStartCommandProvider';

function renderQuickStartCommand(command: string) {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div data-test="quickstart drawer">
      <div class="pf-v6-c-code-block">
        <div class="pf-v6-c-code-block__header">
          <div class="pf-v6-c-code-block__actions">
            <div class="pf-v6-c-code-block__actions-item">
              <button type="button">Copy</button>
            </div>
          </div>
        </div>
        <div class="pf-v6-c-code-block__content">
          <pre><code>${command}</code></pre>
        </div>
      </div>
    </div>`,
  );

  return render(
    <QuickStartCommandProvider>
      <div data-test="test-content" />
    </QuickStartCommandProvider>,
  );
}

describe('QuickStartCommandBridge', () => {
  beforeEach(() => {
    mockNamespace = 'demo';
    mockGet.mockReset();
    mockDelete.mockReset();
    mockPatch.mockReset();
    mockListItems.mockReset();
    mockListItems.mockResolvedValue([
      {
        metadata: {
          name: 'rhel9-server-medium',
          labels: { 'os.template.kubevirt.io/rhel9.0': 'true' },
          annotations: { description: 'RHEL 9 server' },
        },
      },
    ]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('adds a Run control to a code block with a registered command', async () => {
    renderQuickStartCommand('oc get templates -n openshift');

    const run = await screen.findByTestId('quickstart-run-command');
    expect(screen.getAllByTestId('quickstart-run-command')).toHaveLength(1);
    expect(run).toHaveTextContent('Run');

    fireEvent.click(run);

    expect(await screen.findByTestId('quickstart-command-output-result')).toBeInTheDocument();
    expect(mockListItems).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.objectContaining({ kind: 'Template', plural: 'templates' }) as unknown,
        queryParams: { ns: 'openshift' },
      }) as unknown,
    );
  });

  it('leaves unregistered commands copy-only', async () => {
    renderQuickStartCommand('oc whoami');

    await waitFor(() => {
      expect(screen.queryByTestId('quickstart-run-command')).not.toBeInTheDocument();
    });
  });

  it('disables commands that need a project when All projects is selected', async () => {
    mockNamespace = '#ALL_NS#';
    renderQuickStartCommand('oc get vm');

    expect(await screen.findByTestId('quickstart-run-command')).toBeDisabled();
    expect(screen.getByLabelText('Select a project first')).toBeInTheDocument();
  });

  it('allows commands with an explicit namespace in All projects', async () => {
    mockNamespace = '#ALL_NS#';
    renderQuickStartCommand('oc get vm -n my-vms');

    expect(await screen.findByTestId('quickstart-run-command')).toBeEnabled();
  });

  it('requires the exact namespace name before deleting a demo namespace', async () => {
    mockGet.mockResolvedValue({
      metadata: {
        name: 'demo-ns',
        labels: { 'partner-labs.io/demo-namespace': 'true' },
      },
    });
    renderQuickStartCommand('oc delete project demo-ns');

    fireEvent.click(await screen.findByTestId('quickstart-run-command'));

    expect(await screen.findByTestId('quickstart-delete-modal')).toBeInTheDocument();
    const confirm = screen.getByTestId('quickstart-confirm-delete');
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByTestId('quickstart-delete-confirmation'), {
      target: { value: 'wrong-name' },
    });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByTestId('quickstart-delete-confirmation'), {
      target: { value: 'demo-ns' },
    });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({ kind: 'Namespace', plural: 'namespaces' }) as unknown,
        }) as unknown,
      );
    });
  });
});
