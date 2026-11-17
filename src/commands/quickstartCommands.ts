import type { CommandActionRequest } from './types';

/**
 * Exact command -> allowlisted SDK action mappings for QuickStart code blocks.
 *
 * Only read-only or explicitly supported actions belong here. The bridge never
 * interprets the command text at runtime; a missing entry means "Copy only".
 */
export const QUICKSTART_COMMAND_REGISTRY: Readonly<Record<string, CommandActionRequest>> = {
  'oc get templates -n openshift': { action: 'list-templates' },
  'oc get datasource rhel9 -n openshift-virtualization-os-images -o yaml': {
    action: 'get-datasource',
    params: { name: 'rhel9', namespace: 'openshift-virtualization-os-images' },
  },
  'oc get datasource fedora -n openshift-virtualization-os-images -o yaml': {
    action: 'get-datasource',
    params: { name: 'fedora', namespace: 'openshift-virtualization-os-images' },
  },
  'oc get datasources -n openshift-virtualization-os-images': { action: 'list-datasources' },
  'oc get csv -n openshift-cnv': {
    action: 'list-csvs',
    params: { namespace: 'openshift-cnv' },
  },
  'oc get storageclass': { action: 'list-storageclasses' },
  'oc get virtualmachineclusterinstancetypes': { action: 'list-cluster-instancetypes' },
  'oc get virtualmachineclusterpreferences': { action: 'list-cluster-preferences' },
  'oc get vm': { action: 'list-vms' },
  'oc get vmi': { action: 'list-vmis' },
  'oc get vm -A': { action: 'list-vms', params: { allNamespaces: 'true' } },
  'oc get vmi -A': { action: 'list-vmis', params: { allNamespaces: 'true' } },
  'oc get vm -n my-vms': { action: 'list-vms', params: { namespace: 'my-vms' } },
  'oc get vmi -n my-vms': { action: 'list-vmis', params: { namespace: 'my-vms' } },
  'oc get vm fedora-app-vm -n my-vms': {
    action: 'get-vm',
    params: { name: 'fedora-app-vm', namespace: 'my-vms' },
  },
  'oc get vmi fedora-app-vm -n my-vms': {
    action: 'get-vmi',
    params: { name: 'fedora-app-vm', namespace: 'my-vms' },
  },
  'oc get vmi template-custom-vm -n template-example -o yaml': {
    action: 'get-vmi',
    params: { name: 'template-custom-vm', namespace: 'template-example' },
  },
  'oc get dv,pvc -n template-example': {
    action: 'list-template-disks',
    params: { namespace: 'template-example' },
  },
  'oc get vm,template,dv,pvc -n template-example': {
    action: 'list-template-resources',
    params: { namespace: 'template-example' },
  },
  'oc get project vm-ingress-demo': {
    action: 'get-project',
    params: { name: 'vm-ingress-demo' },
  },
  'oc get project windows-golden-images': {
    action: 'get-project',
    params: { name: 'windows-golden-images' },
  },
};

const NAMESPACE_NAME = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const RESERVED_NAMESPACES = new Set(['default', 'kube-node-lease', 'kube-public', 'kube-system']);

export function normalizeCommand(command: string): string {
  return command.replace(/\s+/g, ' ').trim();
}

export function isSafeDemoNamespaceName(name: string): boolean {
  return (
    name.length <= 63 &&
    NAMESPACE_NAME.test(name) &&
    !RESERVED_NAMESPACES.has(name) &&
    name !== 'openshift' &&
    !name.startsWith('openshift-') &&
    !name.startsWith('kube-')
  );
}

/**
 * Parses the small set of namespace lifecycle commands that demos may run
 * without an explicit registry entry. Everything else remains copy-only.
 */
export function parseNamespaceCommand(command: string): CommandActionRequest | undefined {
  const normalized = normalizeCommand(command);

  const createProject = /^oc new-project (\S+)$/.exec(normalized);
  if (createProject && isSafeDemoNamespaceName(createProject[1])) {
    return { action: 'create-demo-project', params: { name: createProject[1] } };
  }

  const createNamespace = /^oc create namespace (\S+)$/.exec(normalized);
  if (createNamespace && isSafeDemoNamespaceName(createNamespace[1])) {
    return { action: 'create-demo-namespace', params: { name: createNamespace[1] } };
  }

  const deleteNamespace = /^oc delete (?:project|namespace) (\S+)(?: --ignore-not-found)?$/.exec(
    normalized,
  );
  if (deleteNamespace && isSafeDemoNamespaceName(deleteNamespace[1])) {
    return { action: 'delete-demo-namespace', params: { name: deleteNamespace[1] } };
  }

  return undefined;
}

export function getQuickStartCommandAction(command: string): CommandActionRequest | undefined {
  const normalized = normalizeCommand(command);
  return QUICKSTART_COMMAND_REGISTRY[normalized] ?? parseNamespaceCommand(normalized);
}
