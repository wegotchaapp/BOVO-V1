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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));

  app.enableShutdownHooks();
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    maxAge: 3600,
  });

  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  app.use('/identity/webhook', express.json({ type: 'application/json', limit: '5mb', verify: (req: any, _res, buf) => {
    (req as any).rawBody = buf;
  }}));

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
  const auditInterceptor = new AuditInterceptor(app.get(Logger), app.get(AuditService));
  app.useGlobalInterceptors(auditInterceptor);

  if (process.env.APP_ENV !== 'production') {
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
bootstrap();
