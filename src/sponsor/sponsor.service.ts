import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailtrapClient } from 'mailtrap';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { MatchSponsorDto } from './dto/match-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { MailtrapContactsService } from './mailtrap-contacts.service';
import { Sponsor } from './entities/sponsor.entity';
import { ChildrenService } from '../children/children.service';

const SENDER = {
  name: 'Kwizera Charity Foundation',
  email: 'hello@vnbcoffee.com',
};

@Injectable()
export class SponsorService {
  private readonly logger = new Logger(SponsorService.name);
  private readonly client = new MailtrapClient({
    token: process.env.MAILTRAP_TOKEN!,
  });

  constructor(
    @InjectRepository(Sponsor)
    private readonly sponsorRepo: Repository<Sponsor>,
    private readonly mailtrapContacts: MailtrapContactsService,
    private readonly childrenService: ChildrenService,
  ) {}

  private renderTemplate(
    name: string,
    context: Record<string, string>,
  ): string {
    const file = fs.readFileSync(
      path.join(__dirname, 'templates', `${name}.hbs`),
      'utf8',
    );
    return handlebars.compile(file)(context);
  }

  async submit(dto: CreateSponsorDto): Promise<void> {
    const { name, email, phone, message } = dto;
    const now = new Date();
    const date = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const year = String(now.getFullYear());

    const heroImage = fs.readFileSync(
      path.join(__dirname, 'templates', 'kids.jpeg'),
    );

    try {
      await this.client.send({
        from: SENDER,
        to: [{ email }],
        subject: 'Thank you for your interest in sponsoring a child!',
        html: this.renderTemplate('acknowledgment', { name, year }),
        attachments: [
          {
            filename: 'kids.jpeg',
            type: 'image/jpeg',
            content: heroImage,
            disposition: 'inline',
            content_id: 'kids-hero',
          },
        ],
      });

      await this.client.send({
        from: SENDER,
        to: [{ email: process.env.NOTIFICATION_EMAIL! }],
        subject: `New sponsorship inquiry from ${name}`,
        html: this.renderTemplate('notification', {
          name,
          email,
          phone: phone || 'Not provided',
          message: message || 'None',
          date,
          year,
        }),
      });
    } catch {
      throw new InternalServerErrorException('Failed to send email');
    }

    try {
      await this.sponsorRepo.upsert(
        { email, name, phone: phone, message: message },
        ['email'],
      );
    } catch (err) {
      this.logger.error('Failed to save sponsor to database', err);
    }

    try {
      await this.mailtrapContacts.upsertContact(dto);
    } catch (err) {
      this.logger.error('Failed to save contact to Mailtrap', err);
    }
  }

  findAll(): Promise<Sponsor[]> {
    return this.sponsorRepo.find({ order: { createdAt: 'DESC' } });
  }

  async update(id: string, dto: UpdateSponsorDto): Promise<Sponsor> {
    const sponsor = await this.sponsorRepo.findOne({ where: { id } });
    if (!sponsor)
      throw new NotFoundException(`Sponsor with id "${id}" not found`);
    Object.assign(sponsor, dto);
    return this.sponsorRepo.save(sponsor);
  }

  async match(dto: MatchSponsorDto): Promise<void> {
    const child = await this.childrenService.findById(dto.childId);

    let sponsor = await this.sponsorRepo.findOne({
      where: { email: dto.sponsorEmail },
    });
    if (!sponsor) {
      sponsor = this.sponsorRepo.create({
        name: dto.sponsorName,
        email: dto.sponsorEmail,
      });
    }
    sponsor.child = child;
    await this.sponsorRepo.save(sponsor);

    const year = String(new Date().getFullYear());

    const childImage = fs.readFileSync(
      path.join(__dirname, 'templates', 'kids.jpeg'),
    );

    try {
      await this.client.send({
        from: SENDER,
        to: [{ email: dto.sponsorEmail }],
        subject: `You've been matched with ${child.name}! – KCF`,
        html: this.renderTemplate('match', {
          sponsorName: dto.sponsorName,
          childName: child.name,
          childAge: String(child.age),
          childSubject: child.subject,
          childDream: child.dream,
          childHobby: child.hobby,
          childPersonality: child.personality,
          childFamily: child.family,
          childLocation: child.location,
          childUniqueQuality: child.uniqueQuality,
          year,
        }),
        attachments: [
          {
            filename: 'kids.jpeg',
            type: 'image/jpeg',
            content: childImage,
            disposition: 'inline',
            content_id: 'match-child',
          },
        ],
      });
    } catch {
      throw new InternalServerErrorException('Failed to send match email');
    }
  }
}
