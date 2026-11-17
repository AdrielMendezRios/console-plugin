import {
  getQuickStartCommandAction,
  normalizeCommand,
  QUICKSTART_COMMAND_REGISTRY,
} from './quickstartCommands';
import { isQuickStartCommandAction } from './supportedActions';

describe('QuickStart command registry', () => {
  it('normalizes whitespace before matching', () => {
    expect(normalizeCommand('  oc   get\ttemplates\n-n openshift  ')).toBe(
      'oc get templates -n openshift',
    );
    expect(getQuickStartCommandAction('oc get templates   -n openshift')).toEqual({
      action: 'list-templates',
    });
  });

  it('maps the VM templates pilot commands to supported actions', () => {
    expect(
      getQuickStartCommandAction(
        'oc get datasource rhel9 -n openshift-virtualization-os-images -o yaml',
      ),
    ).toEqual({
      action: 'get-datasource',
      params: { name: 'rhel9', namespace: 'openshift-virtualization-os-images' },
    });
    expect(
      getQuickStartCommandAction('oc get vmi template-custom-vm -n template-example -o yaml'),
    ).toEqual({
      action: 'get-vmi',
      params: { name: 'template-custom-vm', namespace: 'template-example' },
    });
    expect(getQuickStartCommandAction('oc get dv,pvc -n template-example')).toEqual({
      action: 'list-template-disks',
      params: { namespace: 'template-example' },
    });
  });

  it('only returns read-only actions allowed in a QuickStart', () => {
    for (const request of Object.values(QUICKSTART_COMMAND_REGISTRY)) {
      expect(isQuickStartCommandAction(request.action)).toBe(true);
    }
  });

  it('auto-detects namespace lifecycle commands', () => {
    expect(getQuickStartCommandAction('oc new-project demo-ns')).toEqual({
      action: 'create-demo-project',
      params: { name: 'demo-ns' },
    });
    expect(getQuickStartCommandAction('oc create namespace demo-ns')).toEqual({
      action: 'create-demo-namespace',
      params: { name: 'demo-ns' },
    });
    expect(getQuickStartCommandAction('oc delete project demo-ns')).toEqual({
      action: 'delete-demo-namespace',
      params: { name: 'demo-ns' },
    });
    expect(getQuickStartCommandAction('oc delete namespace demo-ns --ignore-not-found')).toEqual({
      action: 'delete-demo-namespace',
      params: { name: 'demo-ns' },
    });
  });

  it('rejects unsafe or non-exact namespace lifecycle commands', () => {
    for (const command of [
      'oc new-project default',
      'oc new-project openshift',
      'oc new-project openshift-monitoring',
      'oc delete project kube-system',
      'oc new-project Demo',
      'oc new-project -bad',
      'oc new-project bad-',
      'oc new-project demo extra',
      'oc delete project demo extra',
      'oc create namespace demo --dry-run=client',
      'oc new-project demo | cat',
      'oc new-project demo > file',
      'oc new-project "demo"',
    ]) {
      expect(getQuickStartCommandAction(command)).toBeUndefined();
    }
    expect(getQuickStartCommandAction('oc whoami')).toBeUndefined();
    expect(isQuickStartCommandAction('create-vm')).toBe(false);
  });

  it('allows the namespace lifecycle actions in QuickStarts', () => {
    expect(isQuickStartCommandAction('create-demo-project')).toBe(true);
    expect(isQuickStartCommandAction('create-demo-namespace')).toBe(true);
    expect(isQuickStartCommandAction('delete-demo-namespace')).toBe(true);
  });
});
