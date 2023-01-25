import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { JWTPayload } from 'apollo-shared'
import { Profile as GoogleProfile } from 'passport-google-oauth20'

import { CreateUserDto } from '../users/dto/create-user.dto'
import { UsersService } from '../users/users.service'
import { Role, RoleInheritance } from '../utils/role/role.enum'
import { Profile as MicrosoftProfile } from '../utils/strategies/microsoft.strategy'

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name)
  private defaultNewUserRole: 'admin' | 'user' | 'readOnly'

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    configService: ConfigService<
      { DEFAULT_NEW_USER_ROLE: 'admin' | 'user' | 'readOnly' },
      true
    >,
  ) {
    this.defaultNewUserRole = configService.get('DEFAULT_NEW_USER_ROLE', {
      infer: true,
    })
  }

  /**
   * Log in with google
   * @param profile - profile
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  async googleLogin(profile: GoogleProfile) {
    const userRoles = new Set<Role>()
    let defaultRole = this.defaultNewUserRole
    if (!profile._json.email) {
      throw new UnauthorizedException('No email provided')
    }
    // Find user from Mongo
    const userFound = await this.usersService.findByEmail(profile._json.email)
    if (!userFound) {
      if ((await this.usersService.getCount()) === 0) {
        defaultRole = Role.Admin // If there is no any user yet, the 1st user role will be admin
      }
      const newUser: CreateUserDto = {
        email: profile._json.email,
        role: [defaultRole],
        username: profile._json.name ? profile._json.name : 'na',
      }
      const createdUser = await this.usersService.addNew(newUser)

      // Loop the first user's default role(s) and add each role + inherited ones to userRolesArray
      for (const userRole of [defaultRole]) {
        const roles = RoleInheritance[userRole as Role] // Read from role.enum.ts
        roles.forEach((role) => {
          userRoles.add(role)
        })
      }
      const payload: JWTPayload = {
        username: newUser.username,
        email: newUser.email,
        roles: Array.from(userRoles),
        id: createdUser.id,
      }
      // Return token with SUCCESS status
      const returnToken = this.jwtService.sign(payload)
      this.logger.debug(
        `First time login successful. Apollo token: ${JSON.stringify(
          returnToken,
        )}`,
      )
      return { token: returnToken }
    }
    this.logger.debug(`User found in Mongo: ${JSON.stringify(userFound)}`)

    // Loop user's role(s) and add each role + inherited ones to userRolesArray
    for (const userRole of userFound.role) {
      const roles = RoleInheritance[userRole] // Read from role.enum.ts
      roles.forEach((role) => {
        userRoles.add(role)
      })
    }

    const payload: JWTPayload = {
      username: userFound.username,
      email: userFound.email,
      roles: Array.from(userRoles),
      id: userFound.id,
    }
    // Return token with SUCCESS status
    const returnToken = this.jwtService.sign(payload)
    this.logger.debug(
      `Login successful. Apollo token: ${JSON.stringify(returnToken)}`,
    )
    return { token: returnToken }
  }

  /**
   * Log in with microsoft
   * @param profile - profile
   * @returns Return either token with HttpResponse status 'HttpStatus.OK' OR null with 'HttpStatus.UNAUTHORIZED'
   */
  async microsoftLogin(profile: MicrosoftProfile) {
    const userRoles = new Set<Role>()
    let defaultRole = this.defaultNewUserRole
    const [email] = profile.emails
    if (!email) {
      throw new UnauthorizedException('No email provided')
    }
    // Find user from Mongo
    const userFound = await this.usersService.findByEmail(email.value)
    if (!userFound) {
      if ((await this.usersService.getCount()) === 0) {
        defaultRole = Role.Admin // If there is no any user yet, the 1st user role will be admin
      }
      const newUser: CreateUserDto = {
        email: email.value,
        role: [defaultRole],
        username: profile.displayName ? profile.displayName : 'na',
      }
      const createdUser = await this.usersService.addNew(newUser)

      // Loop the first user's default role(s) and add each role + inherited ones to userRolesArray
      for (const userRole of [defaultRole]) {
        const roles = RoleInheritance[userRole as Role] // Read from role.enum.ts
        roles.forEach((role) => {
          userRoles.add(role)
        })
      }
      const payload: JWTPayload = {
        username: newUser.username,
        email: newUser.email,
        roles: Array.from(userRoles),
        id: createdUser.id,
      }
      // Return token with SUCCESS status
      const returnToken = this.jwtService.sign(payload)
      this.logger.debug(
        `First time login successful. Apollo token: ${JSON.stringify(
          returnToken,
        )}`,
      )
      return { token: returnToken }
    }
    this.logger.debug(`User found in Mongo: ${JSON.stringify(userFound)}`)

    // Loop user's role(s) and add each role + inherited ones to userRolesArray
    for (const userRole of userFound.role) {
      const roles = RoleInheritance[userRole] // Read from role.enum.ts
      roles.forEach((role) => {
        userRoles.add(role)
      })
    }

    const payload: JWTPayload = {
      username: userFound.username,
      email: userFound.email,
      roles: Array.from(userRoles),
      id: userFound.id,
    }
    // Return token with SUCCESS status
    const returnToken = this.jwtService.sign(payload)
    this.logger.debug(
      `Login successful. Apollo token: ${JSON.stringify(returnToken)}`,
    )
    return { token: returnToken }
  }
}
