import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceDay } from './entities/attendance-day.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { Child } from '../children/entities/child.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceDay, AttendanceRecord, Child])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
