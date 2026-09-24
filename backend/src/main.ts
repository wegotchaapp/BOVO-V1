import '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditService } from './modules/audit/audit.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import * as express from 'express';
import * as path from 'path';
import {
  createCorsOptions,
  isProductionEnvironment,
} from './common/http/cors.config';
import { registerBodyParsers } from './common/http/webhook-body-parsers';
import { trustedProxyHops } from './common/http/trusted-proxy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));

  app.enableShutdownHooks();
  app.enableCors(createCorsOptions());

  // Throws in production when unset rather than silently bucketing every
  // client behind the edge proxy together. A numeric depth makes `req.ip`
  // (and the rate-limit tracker) read the one X-Forwarded-For entry our own
  // proxies appended, so a caller cannot prepend a fake address.
  app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyHops());

  app.use(helmet());
  app.use(compression());
  registerBodyParsers(app);

  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  const allExceptionsFilter = new AllExceptionsFilter(app.get(Logger));
  app.useGlobalFilters(allExceptionsFilter);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const auditInterceptor = new AuditInterceptor(
    app.get(Logger),
    app.get(AuditService),
  );
  app.useGlobalInterceptors(auditInterceptor);

  if (!isProductionEnvironment()) {
    const config = new DocumentBuilder()
      .setTitle('Bovogo API')
      .setDescription('Peer-to-peer carpooling platform API')
      .setVersion('0.0.1')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT',
      )
      .addTag('auth', 'Authentication & sessions')
      .addTag('identity', 'ID verification & background checks')
      .addTag('profiles', 'User profiles & vehicles')
      .addTag('trips', 'Trip posting & search')
      .addTag('bookings', 'Reservations & lifecycle')
      .addTag('payments', 'Stripe Connect orchestration')
      .addTag('safety', 'SOS, tracking, route deviation')
      .addTag('chat', 'In-app messaging')
      .addTag('trust_safety', 'Reports, moderation, suspensions')
      .addTag('notifications', 'Push, SMS, email')
      .addTag('privacy', 'Data export & deletion (CCPA/Texas)')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    // Mounted at /docs (not /api) so it never shadows the Bovogo mobile
    // compatibility routes served under /api/*.
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`Bovogo backend running on port ${port}`);
}
void bootstrap();
