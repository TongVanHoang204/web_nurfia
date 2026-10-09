export const TEAM_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF'];
export const hasAdminAccess = (role?: string) => TEAM_ROLES.includes(role || '');
export const hasFullAdminAccess = (role?: string) => role === 'OWNER' || role === 'ADMIN';
