// Role permissions
export const ROLES = {
  admin: {
    label: "Admin",
    canAdd: true, canEdit: true, canDelete: true,
    canPrint: true, canViewUsers: true, canViewAudit: true
  },
  data_entry: {
    label: "Data Entry",
    canAdd: true, canEdit: true, canDelete: false,
    canPrint: false, canViewUsers: false, canViewAudit: false
  },
  view_print: {
    label: "View & Print",
    canAdd: true, canEdit: true, canDelete: false,
    canPrint: true, canViewUsers: false, canViewAudit: false
  },
  view: {
    label: "View",
    canAdd: false, canEdit: false, canDelete: false,
    canPrint: false, canViewUsers: false, canViewAudit: false
  }
};

export function getPermissions(role) {
  return ROLES[role] || ROLES.view;
}
