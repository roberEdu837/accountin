import {AuthenticationStrategy, TokenService} from '@loopback/authentication';
import {bind, inject} from '@loopback/context';
import {
  asSpecEnhancer,
  mergeSecuritySchemeToSpec,
  OASEnhancer,
  OpenApiSpec,
} from '@loopback/openapi-v3';
import {HttpErrors, Request} from '@loopback/rest';
import {UserProfile} from '@loopback/security';
import {TokenServiceBindings} from '../keys';

@bind(asSpecEnhancer)
export class JWTAuthenticationStrategy
  implements AuthenticationStrategy, OASEnhancer
{
  name = 'jwt';

  constructor(
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public tokenService: TokenService,
  ) {}

  async authenticate(request: Request): Promise<UserProfile | undefined> {
    const token: string = this.extractCredentials(request);
    const userProfile: UserProfile = await this.tokenService.verifyToken(token);
    return userProfile;
  }

  extractCredentials(request: Request): string {
    if (!request.headers.authorization) {
      throw new HttpErrors.Unauthorized('Authorization header not found.');
    }

    // for example: Bearer xxx.yyy.zzz
    const authHeaderValue = request.headers.authorization;

    if (!authHeaderValue.startsWith('Bearer')) {
      throw new HttpErrors.Unauthorized(
        'Authorization header is not of type "Bearer".',
      );
    }

    // split the string into 2 parts: 'Bearer' and the `xxx.yyy.zzz`
    const parts = authHeaderValue.split(' ');
    if (parts.length !== 2) {
      throw new HttpErrors.Unauthorized(
        'Authorization header value has too many parts. It must follow the pattern: "Bearer xx.yy.zz" where xx.yy.zz is a valid JWT token.',
      );
    }
    const token = parts[1];

    return token;
  }

  modifySpec(spec: OpenApiSpec): OpenApiSpec {
    return mergeSecuritySchemeToSpec(spec, this.name, {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  }
}
