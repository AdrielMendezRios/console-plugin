import {
  k8sCreate,
  k8sDelete,
  k8sGet,
  k8sListItems,
  k8sPatch,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  DEMO_NAMESPACE_LABEL,
  DEMO_NAMESPACE_LABEL_VALUE,
  MANAGED_BY,
  MANAGED_BY_VALUE,
} from '../data/labels';
import { ALL_NAMESPACES_KEY } from '../data/namespace';
import type { CommandActionContext, CommandActionParams, CommandActionRequest } from './types';

const DataSourceModel = {
  apiVersion: 'v1beta1',
  apiGroup: 'cdi.kubevirt.io',
  kind: 'DataSource',
  abbr: 'DS',
  label: 'DataSource',
  labelPlural: 'DataSources',
  plural: 'datasources',
  namespaced: true,
};

const TemplateModel = {
  apiVersion: 'v1',
  apiGroup: 'template.openshift.io',
  kind: 'Template',
  abbr: 'T',
  label: 'Template',
  labelPlural: 'Templates',
  plural: 'templates',
  namespaced: true,
};

const VirtualMachineModel = {
  apiVersion: 'v1',
  apiGroup: 'kubevirt.io',
  kind: 'VirtualMachine',
  abbr: 'VM',
  label: 'VirtualMachine',
  labelPlural: 'VirtualMachines',
  plural: 'virtualmachines',
  namespaced: true,
};

const VirtualMachineInstanceModel = {
  apiVersion: 'v1',
  apiGroup: 'kubevirt.io',
  kind: 'VirtualMachineInstance',
  abbr: 'VMI',
  label: 'VirtualMachineInstance',
  labelPlural: 'VirtualMachineInstances',
  plural: 'virtualmachineinstances',
  namespaced: true,
};

const ProjectRequestModel = {
  apiVersion: 'v1',
  apiGroup: 'project.openshift.io',
  kind: 'ProjectRequest',
  abbr: 'PR',
  label: 'ProjectRequest',
  labelPlural: 'ProjectRequests',
  plural: 'projectrequests',
  namespaced: false,
};

const ProjectModel = {
  apiVersion: 'v1',
  apiGroup: 'project.openshift.io',
  kind: 'Project',
  abbr: 'PR',
  label: 'Project',
  labelPlural: 'Projects',
  plural: 'projects',
  namespaced: false,
};

const NamespaceModel = {
  apiVersion: 'v1',
  apiGroup: 'core',
  kind: 'Namespace',
  abbr: 'NS',
  label: 'Namespace',
  labelPlural: 'Namespaces',
  plural: 'namespaces',
  namespaced: false,
};

const DataVolumeModel = {
  apiVersion: 'v1beta1',
  apiGroup: 'cdi.kubevirt.io',
  kind: 'DataVolume',
  abbr: 'DV',
  label: 'DataVolume',
  labelPlural: 'DataVolumes',
  plural: 'datavolumes',
  namespaced: true,
};

const PersistentVolumeClaimModel = {
  apiVersion: 'v1',
  apiGroup: 'core',
  kind: 'PersistentVolumeClaim',
  abbr: 'PVC',
  label: 'PersistentVolumeClaim',
  labelPlural: 'PersistentVolumeClaims',
  plural: 'persistentvolumeclaims',
  namespaced: true,
};

const StorageClassModel = {
  apiVersion: 'v1',
  apiGroup: 'storage.k8s.io',
  kind: 'StorageClass',
  abbr: 'SC',
  label: 'StorageClass',
  labelPlural: 'StorageClasses',
  plural: 'storageclasses',
  namespaced: false,
};

const ClusterServiceVersionModel = {
  apiVersion: 'v1alpha1',
  apiGroup: 'operators.coreos.com',
  kind: 'ClusterServiceVersion',
  abbr: 'CSV',
  label: 'ClusterServiceVersion',
  labelPlural: 'ClusterServiceVersions',
  plural: 'clusterserviceversions',
  namespaced: true,
};

const VirtualMachineClusterInstancetypeModel = {
  apiVersion: 'v1beta1',
  apiGroup: 'instancetype.kubevirt.io',
  kind: 'VirtualMachineClusterInstancetype',
  abbr: 'VMCI',
  label: 'VirtualMachineClusterInstancetype',
  labelPlural: 'VirtualMachineClusterInstancetypes',
  plural: 'virtualmachineclusterinstancetypes',
  namespaced: false,
};

const VirtualMachineClusterPreferenceModel = {
  apiVersion: 'v1beta1',
  apiGroup: 'instancetype.kubevirt.io',
  kind: 'VirtualMachineClusterPreference',
  abbr: 'VMCP',
  label: 'VirtualMachineClusterPreference',
  labelPlural: 'VirtualMachineClusterPreferences',
  plural: 'virtualmachineclusterpreferences',
  namespaced: false,
};

interface ResourceLike {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  status?: {
    printableStatus?: string;
    phase?: string;
    conditions?: { type: string; status: string }[];
    currentCSV?: string;
  };
  spec?: {
    version?: string;
    provisioner?: string;
    reclaimPolicy?: string;
  };
}

interface ResourceOutput {
  message?: string;
  detail?: string;
}

const PROJECT_SCOPED_ACTIONS = new Set([
  'create-vm',
  'create-custom-template',
  'get-vm',
  'get-vmi',
  'list-vms',
  'list-vmis',
  'list-template-disks',
  'list-template-resources',
]);

export function getCommandPlaceholders(command: string): string[] {
  return Array.from(command.matchAll(/<([^<>]+)>/g), (match) => match[1]);
}

export function commandNeedsProject(
  action: string | undefined,
  namespace: string,
  params?: CommandActionParams,
): boolean {
  if (!action || namespace !== ALL_NAMESPACES_KEY) return false;
  if (params?.namespace || params?.allNamespaces === 'true') return false;
  return PROJECT_SCOPED_ACTIONS.has(action);
}

function createdDate(timestamp?: string): string {
  return timestamp ? new Date(timestamp).toLocaleString() : '';
}

function age(timestamp?: string): string {
  if (!timestamp) return '';
  const elapsed = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h`;
  return `${String(Math.floor(hours / 24))}d`;
}

function listItems(value: unknown): ResourceLike[] {
  return value as ResourceLike[];
}

function detail(resource: unknown): string {
  const cleaned = JSON.parse(JSON.stringify(resource)) as {
    metadata?: { managedFields?: unknown };
  };
  delete cleaned.metadata?.managedFields;
  return JSON.stringify(cleaned, null, 2);
}

function namespaceFromParams(
  params: CommandActionParams | undefined,
  context: CommandActionContext,
) {
  const namespace = params?.namespace;
  if (namespace) return namespace;
  if (context.namespace !== ALL_NAMESPACES_KEY) return context.namespace;
  throw new Error(context.t('Select a project first'));
}

function vmRows(items: ResourceLike[], includeNamespace: boolean): string[] {
  const header = includeNamespace
    ? 'NAMESPACE                       NAME                              STATUS         CREATED'
    : 'NAME                              STATUS         CREATED';
  return [
    header,
    ...items.map((vm) => {
      const name = (vm.metadata?.name ?? '').padEnd(34);
      const status = vm.status?.printableStatus ?? 'Unknown';
      const created = createdDate(vm.metadata?.creationTimestamp);
      if (includeNamespace) {
        const namespace = (vm.metadata?.namespace ?? '').padEnd(31);
        return `${namespace} ${name} ${status.padEnd(15)} ${created}`;
      }
      return `${name} ${status.padEnd(15)} ${created}`;
    }),
  ];
}

function vmiRows(items: ResourceLike[], includeNamespace: boolean): string[] {
  const header = includeNamespace
    ? 'NAMESPACE                       NAME                              PHASE          CREATED'
    : 'NAME                              PHASE          CREATED';
  return [
    header,
    ...items.map((vmi) => {
      const name = (vmi.metadata?.name ?? '').padEnd(34);
      const phase = vmi.status?.phase ?? 'Unknown';
      const created = createdDate(vmi.metadata?.creationTimestamp);
      if (includeNamespace) {
        const namespace = (vmi.metadata?.namespace ?? '').padEnd(31);
        return `${namespace} ${name} ${phase.padEnd(14)} ${created}`;
      }
      return `${name} ${phase.padEnd(14)} ${created}`;
    }),
  ];
}

function listNamespace(
  allNamespaces: boolean,
  params: CommandActionParams | undefined,
  context: CommandActionContext,
): string | undefined {
  if (allNamespaces) return undefined;
  return namespaceFromParams(params, context);
}

function errorStatus(error: unknown): number | undefined {
  const value = error as { code?: number; status?: number; response?: { status?: number } };
  return value.code ?? value.status ?? value.response?.status;
}

function isNotFound(error: unknown): boolean {
  if (errorStatus(error) === 404) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('not found');
}

function hasDemoNamespaceLabel(namespace: ResourceLike): boolean {
  return namespace.metadata?.labels?.[DEMO_NAMESPACE_LABEL] === DEMO_NAMESPACE_LABEL_VALUE;
}

function existingDemoNamespaceMessage(name: string, t: CommandActionContext['t']): ResourceOutput {
  return {
    message: t('Demo namespace "{{name}}" already exists.', { name }),
  };
}

function unmanagedNamespaceMessage(name: string, t: CommandActionContext['t']): Error {
  return new Error(
    t(
      'Namespace "{{name}}" already exists but is not labeled as a Partner Labs demo namespace. Delete it manually or choose another name.',
      { name },
    ),
  );
}

async function createDemoProject(
  name: string,
  t: CommandActionContext['t'],
): Promise<ResourceOutput> {
  try {
    const existing = await k8sGet({ model: NamespaceModel, name });
    if (hasDemoNamespaceLabel(existing)) return existingDemoNamespaceMessage(name, t);
    throw unmanagedNamespaceMessage(name, t);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  await k8sCreate({
    model: ProjectRequestModel,
    data: {
      apiVersion: 'project.openshift.io/v1',
      kind: 'ProjectRequest',
      metadata: { name },
      displayName: name,
      description: 'Partner Labs demo namespace',
    } as never,
  });

  const namespace = await k8sGet({ model: NamespaceModel, name });
  await k8sPatch({
    model: NamespaceModel,
    resource: namespace as never,
    data: [
      {
        op: 'add',
        path: '/metadata/labels',
        value: {
          ...(namespace.metadata?.labels ?? {}),
          [DEMO_NAMESPACE_LABEL]: DEMO_NAMESPACE_LABEL_VALUE,
        },
      },
    ],
  });

  return {
    message: t('Demo namespace "{{name}}" created.', { name }),
  };
}

async function createDemoNamespace(
  name: string,
  t: CommandActionContext['t'],
): Promise<ResourceOutput> {
  try {
    const existing = await k8sGet({ model: NamespaceModel, name });
    if (hasDemoNamespaceLabel(existing)) return existingDemoNamespaceMessage(name, t);
    throw unmanagedNamespaceMessage(name, t);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  await k8sCreate({
    model: NamespaceModel,
    data: {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name,
        labels: { [DEMO_NAMESPACE_LABEL]: DEMO_NAMESPACE_LABEL_VALUE },
      },
    } as never,
  });

  return {
    message: t('Demo namespace "{{name}}" created.', { name }),
  };
}

async function deleteDemoNamespace(
  name: string,
  t: CommandActionContext['t'],
): Promise<ResourceOutput> {
  let namespace: ResourceLike;
  try {
    namespace = await k8sGet({ model: NamespaceModel, name });
  } catch (error) {
    if (isNotFound(error)) {
      return { message: t('Demo namespace "{{name}}" does not exist.', { name }) };
    }
    throw error;
  }

  if (!hasDemoNamespaceLabel(namespace)) {
    throw new Error(
      t(
        'Refusing to delete namespace "{{name}}": it is not labeled as a Partner Labs demo namespace. Delete it manually if appropriate.',
        { name },
      ),
    );
  }

  await k8sDelete({ model: NamespaceModel, resource: namespace as never });
  return {
    message: t('Demo namespace "{{name}}" deleted.', { name }),
  };
}

export async function runCommandAction(
  request: CommandActionRequest,
  context: CommandActionContext,
): Promise<ResourceOutput> {
  const { action, params } = request;
  const { namespace, t } = context;

  switch (action) {
    case 'list-datasources': {
      const dataSourceNamespace = params?.namespace ?? 'openshift-virtualization-os-images';
      const items = listItems(
        await k8sListItems({
          model: DataSourceModel,
          queryParams: { ns: dataSourceNamespace },
        }),
      );
      const rows = items.map((dataSource) => {
        const name = (dataSource.metadata?.name ?? '').padEnd(30);
        const ready = dataSource.status?.conditions?.find(
          (condition) => condition.type === 'Ready',
        );
        const sourceStatus = ready?.status === 'True' ? 'Ready' : 'Not Ready';
        const created = dataSource.metadata?.creationTimestamp
          ? new Date(dataSource.metadata.creationTimestamp).toLocaleDateString()
          : '';
        return `${name} ${sourceStatus.padEnd(15)} ${created}`;
      });
      return {
        message: t('Found {{count}} DataSources in {{namespace}}', {
          count: items.length,
          namespace: dataSourceNamespace,
        }),
        detail: ['NAME                          SOURCE STATUS         AGE', ...rows].join('\n'),
      };
    }
    case 'get-template': {
      const name = params?.name ?? 'fedora-server-small';
      const templateNamespace = params?.namespace ?? 'openshift';
      const template = await k8sGet({
        model: TemplateModel,
        name,
        ns: templateNamespace,
      });
      return {
        message: t('Template "{{name}}" in namespace "{{namespace}}"', {
          name: template.metadata?.name ?? name,
          namespace: templateNamespace,
        }),
        detail: detail(template),
      };
    }
    case 'create-vm': {
      const vmName = `demo-vm-${Date.now().toString(36)}`;
      await k8sCreate({
        model: VirtualMachineModel,
        ns: namespace,
        data: {
          apiVersion: 'kubevirt.io/v1',
          kind: 'VirtualMachine',
          metadata: {
            name: vmName,
            namespace,
            labels: {
              [MANAGED_BY]: MANAGED_BY_VALUE,
            },
          },
          spec: {
            running: true,
            template: {
              metadata: {
                labels: {
                  'kubevirt.io/domain': vmName,
                },
              },
              spec: {
                domain: {
                  devices: {
                    disks: [{ name: 'rootdisk', disk: { bus: 'virtio' } }],
                    interfaces: [{ name: 'default', masquerade: {} }],
                  },
                  resources: { requests: { memory: '2Gi' } },
                },
                networks: [{ name: 'default', pod: {} }],
                volumes: [
                  {
                    name: 'rootdisk',
                    dataVolume: { name: `${vmName}-rootdisk` },
                  },
                ],
              },
            },
            dataVolumeTemplates: [
              {
                metadata: { name: `${vmName}-rootdisk` },
                spec: {
                  sourceRef: {
                    kind: 'DataSource',
                    name: 'fedora',
                    namespace: 'openshift-virtualization-os-images',
                  },
                  storage: { resources: { requests: { storage: '30Gi' } } },
                },
              },
            ],
          },
        } as never,
      });
      return {
        message: t('VM "{{name}}" created in namespace "{{ns}}"', {
          name: vmName,
          ns: namespace,
        }),
      };
    }
    case 'list-templates': {
      const templateNamespace = params?.namespace ?? 'openshift';
      const items = listItems(
        await k8sListItems({
          model: TemplateModel,
          queryParams: { ns: templateNamespace },
        }),
      );
      const vmTemplates = items.filter((template) => {
        const labels = template.metadata?.labels ?? {};
        return Object.keys(labels).some((key) => key.startsWith('os.template.kubevirt.io/'));
      });
      const rows = vmTemplates.map((template) => {
        const name = (template.metadata?.name ?? '').padEnd(36);
        const description = template.metadata?.annotations?.description ?? '';
        const truncated = description.length > 80 ? `${description.slice(0, 77)}...` : description;
        return `${name} ${truncated}`;
      });
      return {
        message: t('Found {{count}} VM templates in {{namespace}}', {
          count: vmTemplates.length,
          namespace: templateNamespace,
        }),
        detail: ['NAME                                DESCRIPTION', ...rows].join('\n'),
      };
    }
    case 'get-rhel9-template': {
      const template = await k8sGet({
        model: TemplateModel,
        name: 'rhel9-server-medium',
        ns: 'openshift',
      });
      return {
        message: t('Template "{{name}}" in namespace "openshift"', {
          name: template.metadata?.name ?? 'rhel9-server-medium',
        }),
        detail: detail(template),
      };
    }
    case 'create-template-project': {
      await k8sCreate({
        model: ProjectRequestModel,
        data: {
          apiVersion: 'project.openshift.io/v1',
          kind: 'ProjectRequest',
          metadata: { name: 'template-example' },
          displayName: 'Template Example',
          description: 'Project for VM template demos',
        } as never,
      });
      return {
        message: t('Project "template-example" created'),
      };
    }
    case 'deploy-from-template': {
      const vmName = `rhel9-${Date.now().toString(36)}`;
      await k8sCreate({
        model: VirtualMachineModel,
        ns: 'template-example',
        data: {
          apiVersion: 'kubevirt.io/v1',
          kind: 'VirtualMachine',
          metadata: {
            name: vmName,
            namespace: 'template-example',
            labels: {
              app: vmName,
              [MANAGED_BY]: MANAGED_BY_VALUE,
              'vm.kubevirt.io/template': 'rhel9-server-medium',
            },
          },
          spec: {
            runStrategy: 'Halted',
            dataVolumeTemplates: [
              {
                apiVersion: 'cdi.kubevirt.io/v1beta1',
                kind: 'DataVolume',
                metadata: { name: vmName },
                spec: {
                  sourceRef: {
                    kind: 'DataSource',
                    name: 'rhel9',
                    namespace: 'openshift-virtualization-os-images',
                  },
                  storage: { resources: { requests: { storage: '30Gi' } } },
                },
              },
            ],
            template: {
              metadata: {
                labels: { 'kubevirt.io/domain': vmName, 'kubevirt.io/size': 'medium' },
              },
              spec: {
                architecture: 'amd64',
                domain: {
                  cpu: { cores: 1, sockets: 1, threads: 1 },
                  devices: {
                    disks: [
                      { disk: { bus: 'virtio' }, name: 'rootdisk' },
                      { disk: { bus: 'virtio' }, name: 'cloudinitdisk' },
                    ],
                    interfaces: [{ masquerade: {}, model: 'virtio', name: 'default' }],
                    rng: {},
                  },
                  features: { smm: { enabled: true } },
                  firmware: { bootloader: { efi: {} } },
                  memory: { guest: '4Gi' },
                },
                networks: [{ name: 'default', pod: {} }],
                terminationGracePeriodSeconds: 180,
                volumes: [
                  { dataVolume: { name: vmName }, name: 'rootdisk' },
                  {
                    cloudInitNoCloud: {
                      userData:
                        '#cloud-config\nuser: cloud-user\npassword: demo-pass\nchpasswd:\n  expire: false\n',
                    },
                    name: 'cloudinitdisk',
                  },
                ],
              },
            },
          },
        } as never,
      });
      return {
        message: t(
          'VM "{{name}}" created in namespace "template-example" (Halted — use virtctl start to boot)',
          { name: vmName },
        ),
      };
    }
    case 'get-template-resources':
    case 'list-template-vms': {
      const vms = listItems(
        await k8sListItems({
          model: VirtualMachineModel,
          queryParams: { ns: 'template-example' },
        }),
      );
      return {
        message: t('Found {{count}} VMs in template-example', { count: vms.length }),
        detail: vmRows(vms, false).join('\n'),
      };
    }
    case 'create-custom-template': {
      await k8sCreate({
        model: TemplateModel,
        ns: namespace,
        data: {
          apiVersion: 'template.openshift.io/v1',
          kind: 'Template',
          metadata: {
            name: 'rhel9-custom',
            namespace,
            annotations: {
              'defaults.template.kubevirt.io/disk': 'rootdisk',
              description:
                'Custom RHEL 9 template with auto-start and configurable cloud-init user',
              iconClass: 'icon-rhel',
              'openshift.io/display-name': 'RHEL 9 Custom VM',
              'openshift.io/provider-display-name': 'Partner Labs',
              tags: 'kubevirt,virtualmachine,linux,rhel',
              'template.kubevirt.io/provider': 'Partner Labs',
            },
            labels: {
              'flavor.template.kubevirt.io/medium': 'true',
              'os.template.kubevirt.io/rhel9.0': 'true',
              'template.kubevirt.io/type': 'base',
              'workload.template.kubevirt.io/server': 'true',
            },
          },
          objects: [
            {
              apiVersion: 'kubevirt.io/v1',
              kind: 'VirtualMachine',
              metadata: {
                name: '${NAME}',
                labels: { app: '${NAME}' },
              },
              spec: {
                runStrategy: 'Always',
                dataVolumeTemplates: [
                  {
                    apiVersion: 'cdi.kubevirt.io/v1beta1',
                    kind: 'DataVolume',
                    metadata: { name: '${NAME}' },
                    spec: {
                      sourceRef: {
                        kind: 'DataSource',
                        name: '${DATA_SOURCE_NAME}',
                        namespace: '${DATA_SOURCE_NAMESPACE}',
                      },
                      storage: { resources: { requests: { storage: '30Gi' } } },
                    },
                  },
                ],
                template: {
                  metadata: {
                    labels: { 'kubevirt.io/domain': '${NAME}', 'kubevirt.io/size': 'medium' },
                  },
                  spec: {
                    architecture: 'amd64',
                    domain: {
                      cpu: { cores: 1, sockets: 1, threads: 1 },
                      devices: {
                        disks: [
                          { disk: { bus: 'virtio' }, name: 'rootdisk' },
                          { disk: { bus: 'virtio' }, name: 'cloudinitdisk' },
                        ],
                        interfaces: [{ masquerade: {}, model: 'virtio', name: 'default' }],
                        rng: {},
                      },
                      features: { smm: { enabled: true } },
                      firmware: { bootloader: { efi: {} } },
                      memory: { guest: '4Gi' },
                    },
                    networks: [{ name: 'default', pod: {} }],
                    terminationGracePeriodSeconds: 180,
                    volumes: [
                      { dataVolume: { name: '${NAME}' }, name: 'rootdisk' },
                      {
                        cloudInitNoCloud: {
                          userData:
                            '#cloud-config\nuser: ${CLOUD_INIT_USERNAME}\npassword: ${CLOUD_INIT_PASSWORD}\nchpasswd:\n  expire: false\n',
                        },
                        name: 'cloudinitdisk',
                      },
                    ],
                  },
                },
              },
            },
          ],
          parameters: [
            {
              description: 'VM name',
              from: 'rhel9-custom-[a-z0-9]{6}',
              generate: 'expression',
              name: 'NAME',
            },
            {
              description: 'Name of the DataSource to clone',
              name: 'DATA_SOURCE_NAME',
              value: 'rhel9',
            },
            {
              description: 'Namespace of the DataSource',
              name: 'DATA_SOURCE_NAMESPACE',
              value: 'openshift-virtualization-os-images',
            },
            {
              description: 'Cloud-init username',
              name: 'CLOUD_INIT_USERNAME',
              value: 'shadowman',
            },
            {
              description: 'Cloud-init password',
              from: '[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}',
              generate: 'expression',
              name: 'CLOUD_INIT_PASSWORD',
            },
          ],
        } as never,
      });
      return {
        message: t('Custom template "rhel9-custom" created in namespace "{{ns}}"', {
          ns: namespace,
        }),
      };
    }
    case 'create-cloning-namespace': {
      await k8sCreate({
        model: ProjectRequestModel,
        data: {
          apiVersion: 'project.openshift.io/v1',
          kind: 'ProjectRequest',
          metadata: { name: 'vm-cloning-demo' },
          displayName: 'VM Cloning Demo',
          description: 'Namespace for VM cloning demonstrations',
        } as never,
      });
      return {
        message: t('Namespace "vm-cloning-demo" created'),
      };
    }
    case 'create-source-vm': {
      const vmName = 'source-webserver';
      await k8sCreate({
        model: VirtualMachineModel,
        ns: 'vm-cloning-demo',
        data: {
          apiVersion: 'kubevirt.io/v1',
          kind: 'VirtualMachine',
          metadata: {
            name: vmName,
            namespace: 'vm-cloning-demo',
            labels: {
              [MANAGED_BY]: MANAGED_BY_VALUE,
            },
          },
          spec: {
            dataVolumeTemplates: [
              {
                apiVersion: 'cdi.kubevirt.io/v1beta1',
                kind: 'DataVolume',
                metadata: { name: `${vmName}-disk` },
                spec: {
                  sourceRef: {
                    kind: 'DataSource',
                    name: 'fedora',
                    namespace: 'openshift-virtualization-os-images',
                  },
                  storage: { resources: { requests: { storage: '30Gi' } } },
                },
              },
            ],
            runStrategy: 'RerunOnFailure',
            template: {
              metadata: {
                labels: { 'kubevirt.io/domain': vmName },
              },
              spec: {
                domain: {
                  cpu: { cores: 2 },
                  devices: {
                    disks: [
                      { disk: { bus: 'virtio' }, name: 'rootdisk' },
                      { disk: { bus: 'virtio' }, name: 'cloudinitdisk' },
                    ],
                    interfaces: [{ masquerade: {}, name: 'default' }],
                    rng: {},
                  },
                  memory: { guest: '4Gi' },
                },
                networks: [{ name: 'default', pod: {} }],
                volumes: [
                  { dataVolume: { name: `${vmName}-disk` }, name: 'rootdisk' },
                  {
                    cloudInitNoCloud: {
                      userData:
                        '#cloud-config\nuser: fedora\npassword: fedora123\nchpasswd:\n  expire: false\nssh_pwauth: true\nruncmd:\n  - dnf install -y nginx\n  - systemctl enable --now nginx\n  - echo "<h1>Source Webserver VM</h1><p>Hostname: $(hostname)</p>" > /usr/share/nginx/html/index.html\n  - firewall-cmd --permanent --add-service=http\n  - firewall-cmd --reload\n',
                    },
                    name: 'cloudinitdisk',
                  },
                ],
              },
            },
          },
        } as never,
      });
      return {
        message: t('Source VM "{{name}}" created in namespace "vm-cloning-demo"', {
          name: vmName,
        }),
      };
    }
    case 'create-clone-datavolume': {
      const dvName = 'webserver-clone-2-disk';
      await k8sCreate({
        model: DataVolumeModel,
        ns: 'vm-cloning-demo',
        data: {
          apiVersion: 'cdi.kubevirt.io/v1beta1',
          kind: 'DataVolume',
          metadata: {
            name: dvName,
            namespace: 'vm-cloning-demo',
            annotations: {
              'cdi.kubevirt.io/storage.bind.immediate.requested': 'true',
            },
          },
          spec: {
            source: {
              pvc: {
                name: 'source-webserver-disk',
                namespace: 'vm-cloning-demo',
              },
            },
            storage: {
              accessModes: ['ReadWriteOnce'],
              resources: {
                requests: {
                  storage: '30Gi',
                },
              },
            },
          },
        } as never,
      });
      return {
        message: t('DataVolume "{{name}}" created to clone source VM PVC', {
          name: dvName,
        }),
      };
    }
    case 'create-clone-vm': {
      const vmName = 'webserver-clone-2';
      await k8sCreate({
        model: VirtualMachineModel,
        ns: 'vm-cloning-demo',
        data: {
          apiVersion: 'kubevirt.io/v1',
          kind: 'VirtualMachine',
          metadata: {
            name: vmName,
            namespace: 'vm-cloning-demo',
            labels: {
              [MANAGED_BY]: MANAGED_BY_VALUE,
            },
          },
          spec: {
            runStrategy: 'Manual',
            template: {
              metadata: {
                labels: { 'kubevirt.io/domain': vmName },
              },
              spec: {
                domain: {
                  cpu: { cores: 2 },
                  devices: {
                    disks: [{ disk: { bus: 'virtio' }, name: 'rootdisk' }],
                    interfaces: [{ masquerade: {}, name: 'default' }],
                    rng: {},
                  },
                  memory: { guest: '4Gi' },
                },
                networks: [{ name: 'default', pod: {} }],
                volumes: [
                  {
                    name: 'rootdisk',
                    persistentVolumeClaim: {
                      claimName: 'webserver-clone-2-disk',
                    },
                  },
                ],
              },
            },
          },
        } as never,
      });
      return {
        message: t('VM "{{name}}" created from cloned PVC (Manual — use virtctl start to boot)', {
          name: vmName,
        }),
      };
    }
    case 'cleanup-cloning-demo': {
      const vms = listItems(
        await k8sListItems({
          model: VirtualMachineModel,
          queryParams: { ns: 'vm-cloning-demo' },
        }),
      );
      const dvs = listItems(
        await k8sListItems({
          model: DataVolumeModel,
          queryParams: { ns: 'vm-cloning-demo' },
        }),
      );
      return {
        message: t(
          'Found {{vmCount}} VMs and {{dvCount}} DataVolumes in vm-cloning-demo. Delete namespace to remove all resources.',
          { vmCount: vms.length, dvCount: dvs.length },
        ),
      };
    }
    case 'get-datasource': {
      const dataSourceNamespace = params?.namespace ?? 'openshift-virtualization-os-images';
      const name = params?.name;
      if (!name) throw new Error(t('This command must be run manually in a terminal.'));
      const dataSource = await k8sGet({
        model: DataSourceModel,
        name,
        ns: dataSourceNamespace,
      });
      return {
        message: t('DataSource "{{name}}" in namespace "{{namespace}}"', {
          name: dataSource.metadata?.name ?? name,
          namespace: dataSourceNamespace,
        }),
        detail: detail(dataSource),
      };
    }
    case 'get-vm': {
      const name = params?.name;
      if (!name) throw new Error(t('This command must be run manually in a terminal.'));
      const vmNamespace = namespaceFromParams(params, context);
      const vm = await k8sGet({
        model: VirtualMachineModel,
        name,
        ns: vmNamespace,
      });
      return {
        message: t('VirtualMachine "{{name}}" in namespace "{{namespace}}"', {
          name: vm.metadata?.name ?? name,
          namespace: vmNamespace,
        }),
        detail: detail(vm),
      };
    }
    case 'get-vmi': {
      const name = params?.name;
      if (!name) throw new Error(t('This command must be run manually in a terminal.'));
      const vmiNamespace = namespaceFromParams(params, context);
      const vmi = await k8sGet({
        model: VirtualMachineInstanceModel,
        name,
        ns: vmiNamespace,
      });
      return {
        message: t('VirtualMachineInstance "{{name}}" in namespace "{{namespace}}"', {
          name: vmi.metadata?.name ?? name,
          namespace: vmiNamespace,
        }),
        detail: detail(vmi),
      };
    }
    case 'list-vms': {
      const allNamespaces = params?.allNamespaces === 'true';
      const vmNamespace = listNamespace(allNamespaces, params, context);
      const vms = listItems(
        await k8sListItems({
          model: VirtualMachineModel,
          queryParams: vmNamespace ? { ns: vmNamespace } : {},
        }),
      );
      return {
        message: t('Found {{count}} VMs in {{namespace}}', {
          count: vms.length,
          namespace: allNamespaces ? t('all projects') : (vmNamespace ?? ''),
        }),
        detail: vmRows(vms, allNamespaces).join('\n'),
      };
    }
    case 'list-vmis': {
      const allNamespaces = params?.allNamespaces === 'true';
      const vmiNamespace = listNamespace(allNamespaces, params, context);
      const vmis = listItems(
        await k8sListItems({
          model: VirtualMachineInstanceModel,
          queryParams: vmiNamespace ? { ns: vmiNamespace } : {},
        }),
      );
      return {
        message: t('Found {{count}} VMIs in {{namespace}}', {
          count: vmis.length,
          namespace: allNamespaces ? t('all projects') : (vmiNamespace ?? ''),
        }),
        detail: vmiRows(vmis, allNamespaces).join('\n'),
      };
    }
    case 'list-template-disks': {
      const diskNamespace = namespaceFromParams(params, context);
      const [dvItems, pvcItems] = await Promise.all([
        k8sListItems({
          model: DataVolumeModel,
          queryParams: { ns: diskNamespace },
        }),
        k8sListItems({
          model: PersistentVolumeClaimModel,
          queryParams: { ns: diskNamespace },
        }),
      ]);
      const dvs = dvItems as ResourceLike[];
      const pvcs = pvcItems as ResourceLike[];
      const dvRows = dvs.map((dv) => {
        const name = (dv.metadata?.name ?? '').padEnd(34);
        const phase = dv.status?.phase ?? 'Unknown';
        return `${name} ${phase.padEnd(15)} ${createdDate(dv.metadata?.creationTimestamp)}`;
      });
      const pvcRows = pvcs.map((pvc) => {
        const name = (pvc.metadata?.name ?? '').padEnd(34);
        const phase = pvc.status?.phase ?? 'Unknown';
        return `${name} ${phase.padEnd(15)} ${createdDate(pvc.metadata?.creationTimestamp)}`;
      });
      return {
        message: t('Found {{dvCount}} DataVolumes and {{pvcCount}} PVCs in "{{namespace}}"', {
          dvCount: dvs.length,
          pvcCount: pvcs.length,
          namespace: diskNamespace,
        }),
        detail: [
          'DATAVOLUMES',
          'NAME                              PHASE           CREATED',
          ...dvRows,
          '',
          'PERSISTENTVOLUMECLAIMS',
          'NAME                              PHASE           CREATED',
          ...pvcRows,
        ].join('\n'),
      };
    }
    case 'list-template-resources': {
      const resourceNamespace = namespaceFromParams(params, context);
      const [vmItems, templateItems, dvItems, pvcItems] = await Promise.all([
        k8sListItems({
          model: VirtualMachineModel,
          queryParams: { ns: resourceNamespace },
        }),
        k8sListItems({
          model: TemplateModel,
          queryParams: { ns: resourceNamespace },
        }),
        k8sListItems({
          model: DataVolumeModel,
          queryParams: { ns: resourceNamespace },
        }),
        k8sListItems({
          model: PersistentVolumeClaimModel,
          queryParams: { ns: resourceNamespace },
        }),
      ]);
      const vms = vmItems as ResourceLike[];
      const templates = templateItems as ResourceLike[];
      const dvs = dvItems as ResourceLike[];
      const pvcs = pvcItems as ResourceLike[];
      const templateRows = templates.map((template) => {
        const name = (template.metadata?.name ?? '').padEnd(34);
        const displayName = template.metadata?.annotations?.['openshift.io/display-name'] ?? '';
        return `${name} ${displayName}`;
      });
      const dvRows = dvs.map((dv) => {
        const name = (dv.metadata?.name ?? '').padEnd(34);
        const phase = dv.status?.phase ?? 'Unknown';
        return `${name} ${phase.padEnd(15)} ${createdDate(dv.metadata?.creationTimestamp)}`;
      });
      const pvcRows = pvcs.map((pvc) => {
        const name = (pvc.metadata?.name ?? '').padEnd(34);
        const phase = pvc.status?.phase ?? 'Unknown';
        return `${name} ${phase.padEnd(15)} ${createdDate(pvc.metadata?.creationTimestamp)}`;
      });
      return {
        message: t(
          'Found {{vmCount}} VMs, {{templateCount}} templates, {{dvCount}} DataVolumes, and {{pvcCount}} PVCs in "{{namespace}}"',
          {
            vmCount: vms.length,
            templateCount: templates.length,
            dvCount: dvs.length,
            pvcCount: pvcs.length,
            namespace: resourceNamespace,
          },
        ),
        detail: [
          'VIRTUALMACHINES',
          ...vmRows(vms, false),
          '',
          'TEMPLATES',
          'NAME                               DISPLAY NAME',
          ...templateRows,
          '',
          'DATAVOLUMES',
          'NAME                              PHASE           CREATED',
          ...dvRows,
          '',
          'PERSISTENTVOLUMECLAIMS',
          'NAME                              PHASE           CREATED',
          ...pvcRows,
        ].join('\n'),
      };
    }
    case 'get-project': {
      const name = params?.name;
      if (!name) throw new Error(t('This command must be run manually in a terminal.'));
      const project = await k8sGet({
        model: ProjectModel,
        name,
      });
      return {
        message: t('Project "{{name}}"', { name: project.metadata?.name ?? name }),
        detail: detail(project),
      };
    }
    case 'list-storageclasses': {
      const storageClasses = listItems(
        await k8sListItems({
          model: StorageClassModel,
          queryParams: {},
        }),
      );
      const rows = storageClasses.map((storageClass) => {
        const name = (storageClass.metadata?.name ?? '').padEnd(34);
        const provisioner = (storageClass.spec?.provisioner ?? '').padEnd(40);
        const reclaimPolicy = storageClass.spec?.reclaimPolicy ?? 'Delete';
        return `${name} ${provisioner} ${reclaimPolicy}`;
      });
      return {
        message: t('Found {{count}} StorageClasses', { count: storageClasses.length }),
        detail: [
          'NAME                               PROVISIONER                              RECLAIM POLICY',
          ...rows,
        ].join('\n'),
      };
    }
    case 'list-cluster-instancetypes': {
      const instancetypes = listItems(
        await k8sListItems({
          model: VirtualMachineClusterInstancetypeModel,
          queryParams: {},
        }),
      );
      return {
        message: t('Found {{count}} cluster instancetypes', { count: instancetypes.length }),
        detail: [
          'NAME                               AGE',
          ...instancetypes.map((instancetype) => {
            const name = (instancetype.metadata?.name ?? '').padEnd(34);
            return `${name} ${age(instancetype.metadata?.creationTimestamp)}`;
          }),
        ].join('\n'),
      };
    }
    case 'list-cluster-preferences': {
      const preferences = listItems(
        await k8sListItems({
          model: VirtualMachineClusterPreferenceModel,
          queryParams: {},
        }),
      );
      return {
        message: t('Found {{count}} cluster preferences', { count: preferences.length }),
        detail: [
          'NAME                               AGE',
          ...preferences.map((preference) => {
            const name = (preference.metadata?.name ?? '').padEnd(34);
            return `${name} ${age(preference.metadata?.creationTimestamp)}`;
          }),
        ].join('\n'),
      };
    }
    case 'list-csvs': {
      const csvNamespace = params?.namespace ?? 'openshift-cnv';
      const csvs = listItems(
        await k8sListItems({
          model: ClusterServiceVersionModel,
          queryParams: { ns: csvNamespace },
        }),
      );
      const rows = csvs.map((csv) => {
        const name = (csv.metadata?.name ?? '').padEnd(40);
        const phase = (csv.status?.phase ?? 'Unknown').padEnd(15);
        const version = csv.spec?.version ?? csv.status?.currentCSV ?? '';
        return `${name} ${phase} ${version}`;
      });
      return {
        message: t('Found {{count}} ClusterServiceVersions in {{namespace}}', {
          count: csvs.length,
          namespace: csvNamespace,
        }),
        detail: ['NAME                                     PHASE           VERSION', ...rows].join(
          '\n',
        ),
      };
    }
    case 'create-demo-project': {
      const name = params?.name;
      if (!name) throw new Error(t('This command must be run manually in a terminal.'));
      return createDemoProject(name, t);
    }
    case 'create-demo-namespace': {
      const name = params?.name;
      if (!name) throw new Error(t('This command must be run manually in a terminal.'));
      return createDemoNamespace(name, t);
    }
    case 'delete-demo-namespace': {
      const name = params?.name;
      if (!name) throw new Error(t('This command must be run manually in a terminal.'));
      return deleteDemoNamespace(name, t);
    }
    default:
      throw new Error(t('This command must be run manually in a terminal.'));
  }
}
