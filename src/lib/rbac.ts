import { UserRole } from '../types';

export const PERMISSIONS = {
  CAN_SEND_NOTIFICATIONS: ['superadmin', 'manager', 'mudeer'],
  CAN_APPROVE_FEE: ['superadmin', 'manager', 'mudeer', 'mudaris'], // Mudarris can only approve his class, handled in local logic
  CAN_VIEW_REPORTS: ['superadmin', 'manager', 'mudeer'],
  CAN_ADD_EXPENSES: ['superadmin', 'manager', 'mudeer'],
  CAN_DELETE_USERS: ['superadmin', 'manager'],
  CAN_EDIT_BRANDING: ['superadmin', 'manager'],
  CAN_VIEW_LOGS: ['superadmin'],
  CAN_MANAGE_USERS: ['superadmin', 'manager', 'mudeer', 'mudaris'],
  CAN_VIEW_DASHBOARD_GRAPHS: ['superadmin', 'manager', 'mudeer', 'mudaris'],
};

export function hasPermission(role: UserRole | undefined, permission: keyof typeof PERMISSIONS): boolean {
  if (!role) return false;
  if (role === 'superadmin') return true;
  return PERMISSIONS[permission].includes(role);
}

export function isPrincipal(role: UserRole | undefined): boolean {
  return role === 'mudeer';
}

export function isTeacher(role: UserRole | undefined): boolean {
  return role === 'teacher' || role === 'mudaris';
}

export function isManager(role: UserRole | undefined): boolean {
  return role === 'manager' || role === 'muntazim';
}

export function isStudent(role: UserRole | undefined): boolean {
  return role === 'student';
}
