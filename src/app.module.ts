import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SponsorModule } from './sponsor/sponsor.module';
import { ChildrenModule } from './children/children.module';
import { Child } from './children/entities/child.entity';
import { Sponsor } from './sponsor/entities/sponsor.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [Sponsor, Child],
      synchronize: true,
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
      retryAttempts: 10,
      retryDelay: 3000,
      extra: {
        // TCP keepalive so the OS detects dead connections before TypeORM reuses them
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        // Drop idle pool connections after 10 minutes so stale ones don't accumulate
        idleTimeoutMillis: 600000,
        connectionTimeoutMillis: 10000,
      },
    }),
    SponsorModule,
    ChildrenModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
