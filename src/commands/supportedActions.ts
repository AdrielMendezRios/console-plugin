/**
 * Keep this list free of SDK and React imports so the QuickStart validator can
 * use it from Node without loading browser-only modules.
 */
export const SUPPORTED_COMMAND_ACTIONS = [
  // Cookbook actions.
  'list-datasources',
  'get-template',
  'create-vm',
  'list-templates',
  'get-rhel9-template',
  'create-template-project',
  'deploy-from-template',
  'get-template-resources',
  'create-custom-template',
  'list-template-vms',
  'create-cloning-namespace',
  'create-source-vm',
  'create-clone-datavolume',
  'create-clone-vm',
  'cleanup-cloning-demo',
  // Read-only actions available to QuickStart commands.
  'get-datasource',
  'get-vm',
  'get-vmi',
  'list-vms',
  'list-vmis',
  'list-template-disks',
  'list-template-resources',
  'get-project',
  'list-storageclasses',
  'list-cluster-instancetypes',
  'list-cluster-preferences',
  'list-csvs',
  // Namespace lifecycle actions available to QuickStarts.
  'create-demo-project',
  'create-demo-namespace',
  'delete-demo-namespace',
] as const;

export const QUICKSTART_COMMAND_ACTIONS = [
  'list-datasources',
  'get-template',
  'list-templates',
  'get-rhel9-template',
  'get-template-resources',
  'list-template-vms',
  'get-datasource',
  'get-vm',
  'get-vmi',
  'list-vms',
  'list-vmis',
  'list-template-disks',
  'list-template-resources',
  'get-project',
  'list-storageclasses',
  'list-cluster-instancetypes',
  'list-cluster-preferences',
  'list-csvs',
  'create-demo-project',
  'create-demo-namespace',
  'delete-demo-namespace',
] as const;

export type CommandRisk = 'read' | 'write' | 'delete';

const supported = new Set<string>(SUPPORTED_COMMAND_ACTIONS);
const quickStartSupported = new Set<string>(QUICKSTART_COMMAND_ACTIONS);
const destructive = new Set<string>(['delete-demo-namespace']);

export function isSupportedCommandAction(action: string): boolean {
  return supported.has(action);
}

export function isQuickStartCommandAction(action: string): boolean {
  return quickStartSupported.has(action);
}

export function getCommandRisk(action: string): CommandRisk {
  if (destructive.has(action)) return 'delete';
  if (action.startsWith('create-')) return 'write';
  return 'read';
}
