// Role permissions
export const ROLES = {
  admin: {
    label: "Admin",
    canAdd: true, canEdit: true, canDelete: true, canDeleteDuplicate: true,
    canPrint: true, canViewUsers: true, canViewAudit: true,
    canViewNotifications: true, canViewReports: true,
  },
  standard_admin: {
    label: "Standard Admin",
    canAdd: true, canEdit: true, canDelete: true, canDeleteDuplicate: true,
    canPrint: true, canViewUsers: false, canViewAudit: false,
    canViewNotifications: true, canViewReports: true,
  },
  data_entry: {
    label: "Data Entry",
    canAdd: true, canEdit: true, canDelete: false, canDeleteDuplicate: true,
    canPrint: false, canViewUsers: false, canViewAudit: false,
    canViewNotifications: true, canViewReports: true,
  },
  view: {
    label: "View Only",
    canAdd: false, canEdit: false, canDelete: false, canDeleteDuplicate: false,
    canPrint: false, canViewUsers: false, canViewAudit: false,
    canViewNotifications: true, canViewReports: true,
  },
};

export function getPermissions(role) {
  // view_print is the legacy name for standard_admin
  if (role === "view_print") return ROLES.standard_admin;
  return ROLES[role] || ROLES.view;
}
