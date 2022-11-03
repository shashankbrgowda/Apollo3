import { Role } from '../role/role.enum'

export function getRequiredRoleForChange(changeName: string) {
  if (
    [
      'AddAssemblyFromFileChange',
      'AddAssemblyAndFeaturesFromFileChange',
      'AddFeaturesFromFileChange',
    ].includes(changeName)
  ) {
    return Role.Admin
  }
  return Role.User
}