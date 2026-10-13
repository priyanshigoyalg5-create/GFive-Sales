import type { Role } from './types';

/**
 * Feature permissions. Super Admin has everything; Admin (Sales Person) has a
 * fixed basic set; each Sub Admin gets exactly what the Super Admin ticks for them.
 * The same keys are checked in firestore.rules and the /api routes.
 */
export const PERMISSIONS = [
  { key: 'addSamples', group: 'Samples', label: 'Add new samples', hint: 'Upload designs and create share links' },
  { key: 'addForOthers', group: 'Samples', label: 'Add samples for another Admin', hint: 'When someone is busy or unwell — the sample is put in their name', needs: 'addSamples' },
  { key: 'editAllSamples', group: 'Samples', label: 'Edit / trash any sample', hint: 'Not only the samples they added' },
  { key: 'deleteSamples', group: 'Samples', label: 'Delete samples forever', hint: 'Permanently remove from Trash' },
  { key: 'aiMedia', group: 'Samples', label: 'AI model photo & video', hint: 'Uses paid Google AI credit' },
  { key: 'viewAllOrders', group: 'Orders', label: 'See every Sales Person’s orders', hint: 'Otherwise only orders from their own links' },
  { key: 'manageAllOrders', group: 'Orders', label: 'Change status of all orders', hint: 'Pending / Dispatched / Completed / Trash', needs: 'viewAllOrders' },
  { key: 'reassignOrders', group: 'Orders', label: 'Change Sales Person credit', hint: 'Who gets the order for salary', needs: 'viewAllOrders' },
  { key: 'deleteOrders', group: 'Orders', label: 'Delete orders forever', needs: 'viewAllOrders' },
  { key: 'staffSales', group: 'Reports', label: 'Sales Person Sales report', hint: 'Sales of every Sales Person (salary)', needs: 'viewAllOrders' },
  { key: 'askAI', group: 'Reports', label: 'Ask AI', hint: 'Sales questions to the AI assistant' },
  { key: 'manageTeam', group: 'Team & settings', label: 'Add / disable Admins', hint: 'Cannot create Sub Admins or Super Admins' },
  { key: 'settings', group: 'Team & settings', label: 'Company settings', hint: 'Name, address, GSTIN, WhatsApp, invoice note' },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];
export type PermissionMap = Partial<Record<Permission, boolean>>;

/** What a plain Admin (Sales Person) can do. */
export const ADMIN_PERMISSIONS: Permission[] = ['addSamples', 'aiMedia', 'askAI'];

/** Suggested starting point when a Sub Admin is created. */
export const SUBADMIN_DEFAULTS: PermissionMap = { addSamples: true, aiMedia: true, askAI: true, viewAllOrders: true };

export function hasPermission(role: Role | null | undefined, perms: PermissionMap | undefined, p: Permission): boolean {
  if (role === 'superadmin') return true;
  if (role === 'subadmin') {
    const need = PERMISSIONS.find((x) => x.key === p) as { needs?: Permission } | undefined;
    return !!perms?.[p] && (!need?.needs || !!perms?.[need.needs]);
  }
  if (role === 'admin') return ADMIN_PERMISSIONS.includes(p);
  return false;
}

/** Keeps only known keys and switches off options whose requirement is off. */
export function cleanPermissions(perms: PermissionMap): Record<Permission, boolean> {
  const out = {} as Record<Permission, boolean>;
  for (const p of PERMISSIONS) out[p.key] = !!perms[p.key];
  for (const p of PERMISSIONS) {
    const need = (p as { needs?: Permission }).needs;
    if (need && !out[need]) out[p.key] = false;
  }
  return out;
}

export const ROLE_LABEL: Record<Role, string> = { superadmin: 'Super Admin', subadmin: 'Sub Admin', admin: 'Admin' };
