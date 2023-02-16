import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Request } from 'express'

import { GoogleAuthGuard } from '../utils/google.guard'
import { Public } from '../utils/jwt-auth.guard'
import { MicrosoftAuthGuard } from '../utils/microsoft.guard'
import { AuthenticationService } from './authentication.service'

interface RequestWithUserToken extends Request {
  user: { token: string }
}

@Public()
@Controller('auth')
export class AuthenticationController {
  private readonly logger = new Logger(AuthenticationController.name)

  constructor(private readonly authService: AuthenticationService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  authLogin() {}

  @Get('google/redirect')
  @Redirect()
  @UseGuards(GoogleAuthGuard)
  async handleRedirect(@Req() req: RequestWithUserToken) {
    if (!req.user) {
      throw new BadRequestException()
    }

    const { appURL } = (req.authInfo as { state: { appURL: string } }).state
    const url = new URL(appURL)
    const searchParams = new URLSearchParams({ access_token: req.user.token })
    url.search = searchParams.toString()
    return { url: url.toString() }
  }

  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  microsoftAuthLogin() {}

  @Get('microsoft/redirect')
  @Redirect()
  @UseGuards(MicrosoftAuthGuard)
  async microsoftHandleRedirect(@Req() req: RequestWithUserToken) {
    if (!req.user) {
      throw new BadRequestException()
    }

    const { appURL } = (req.authInfo as { state: { appURL: string } }).state
    const url = new URL(appURL)
    const searchParams = new URLSearchParams({ access_token: req.user.token })
    url.search = searchParams.toString()
    return { url: url.toString() }
  }

  @Get('guest')
  guestLogin() {
    return this.authService.guestLogin()
  }
}
