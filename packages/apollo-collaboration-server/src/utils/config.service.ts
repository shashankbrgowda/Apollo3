import { TypeOrmModuleOptions } from '@nestjs/typeorm'

class ConfigService {
  constructor(private env: { [k: string]: string | undefined }) {}

  private getValue(key: string): string | undefined
  private getValue<T extends boolean>(
    key: string,
    throwOnMissing: T,
  ): T extends true ? string : string | undefined
  private getValue(key: string, throwOnMissing?: boolean) {
    const value = this.env[key]
    if (throwOnMissing) {
      if (!value) {
        throw new Error(`config error - missing env.${key}`)
      }
      return value
    }
    return value
  }

  public ensureValues(keys: string[]) {
    keys.forEach((k) => this.getValue(k, true))
    return this
  }

  public getPort() {
    return this.getValue('PORT', true)
  }

  public isProduction() {
    const mode = this.getValue('MODE', false)
    return mode !== 'DEV'
  }

  public getTypeOrmConfig(): TypeOrmModuleOptions {
    return {
      type: 'mysql',
      name: 'default',
      host: this.getValue('MYSQL_HOST'),
      port: parseInt(this.getValue('MYSQL_PORT', true), 10),
      username: this.getValue('MYSQL_USER'),
      password: this.getValue('MYSQL_PASSWORD'),
      database: this.getValue('MYSQL_DATABASE'),
      entities: ['**/*.entity{.ts,.js}'],
      autoLoadEntities: true,
      synchronize: false,
    }
  }
}

const configService = new ConfigService(process.env).ensureValues([
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
])

export { configService }
