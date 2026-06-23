import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { User } from '../../database/entities/user.entity';
import { BackgroundCheck } from '../../database/entities/identity.entities';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class AdverseActionService {
  private readonly resendApiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.resendApiKey = this.config.get<string>('RESEND_API_KEY') || '';
  }

  async sendClearNotification(user: User): Promise<void> {
    const email: EmailPayload = {
      to: user.email,
      subject: 'Your Bovogo Background Check Has Been Approved',
      html: this.clearEmailHtml(user),
      text: `Hi ${user.name}, great news! Your background check has been approved. You can now start posting trips and driving on Bovogo.`,
    };

    await this.sendEmail(email);
  }

  async sendConsiderNotification(user: User): Promise<void> {
    const email: EmailPayload = {
      to: user.email,
      subject: 'Action Required: Bovogo Background Check Review',
      html: this.considerEmailHtml(user),
      text: `Hi ${user.name}, your background check requires manual review by our team. We will reach out within 2-3 business days with an update.`,
    };

    await this.sendEmail(email);
  }

  async sendPreAdverseNotice(
    user: User,
    bgCheckId: string,
    candidateId: string,
  ): Promise<void> {
    const fiveBusinessDays = this.calculateFiveBusinessDays();

    const email: EmailPayload = {
      to: user.email,
      subject: 'Important: Bovogo Background Check — Pre-Adverse Action Notice',
      html: this.preAdverseEmailHtml(user, fiveBusinessDays, candidateId),
      text: this.preAdverseEmailText(user, fiveBusinessDays),
    };

    await this.sendEmail(email);

    this.logger.info(
      { userId: user.id, bgCheckId, deadline: fiveBusinessDays },
      'Pre-adverse action notice sent',
    );
  }

  async sendFinalAdverseNotice(
    user: User,
    bgCheckId: string,
    candidateId: string,
  ): Promise<void> {
    const email: EmailPayload = {
      to: user.email,
      subject: 'Bovogo Background Check — Adverse Action Final Notice',
      html: this.finalAdverseEmailHtml(user, candidateId),
      text: this.finalAdverseEmailText(user, candidateId),
    };

    await this.sendEmail(email);

    this.logger.info(
      { userId: user.id, bgCheckId },
      'Final adverse action notice sent',
    );
  }

  async scheduleFinalAdverseNotice(bgCheck: BackgroundCheck): Promise<void> {
    const fiveBusinessDaysMs = 5 * 24 * 60 * 60 * 1000;

    const deadline = new Date();
    deadline.setTime(deadline.getTime() + fiveBusinessDaysMs);
    bgCheck.adverse_action_deadline = deadline.toISOString();

    this.logger.info(
      {
        userId: bgCheck.user_id,
        deadline: bgCheck.adverse_action_deadline,
      },
      'Final adverse action notice scheduled',
    );
  }

  private async sendEmail(payload: EmailPayload): Promise<void> {
    if (!this.resendApiKey) {
      this.logger.warn(
        { to: payload.to },
        'RESEND_API_KEY not configured, skipping email',
      );
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Bovogo Safety <safety@bovogo.com>',
          to: [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        this.logger.error(
          { to: payload.to, error },
          'Failed to send email via Resend',
        );
      } else {
        this.logger.info({ to: payload.to }, 'Email sent successfully');
      }
    } catch (error) {
      this.logger.error(
        { to: payload.to, error },
        'Failed to send email',
      );
    }
  }

  private calculateFiveBusinessDays(): string {
    const date = new Date();
    let businessDaysAdded = 0;

    while (businessDaysAdded < 5) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) {
        businessDaysAdded++;
      }
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private clearEmailHtml(user: User): string {
    return `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00e5a0;">Background Check Approved</h1>
        <p>Hi ${user.name},</p>
        <p>Great news! Your background check has been <strong>approved</strong>.</p>
        <p>You can now post trips and drive on Bovogo. Your driver badge will appear on your profile within 24 hours.</p>
        <p>Thank you for helping us keep our community safe.</p>
        <p>— The Bovogo Safety Team</p>
      </div>
    `;
  }

  private considerEmailHtml(user: User): string {
    return `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f0c040;">Background Check Under Review</h1>
        <p>Hi ${user.name},</p>
        <p>Your background check requires additional review by our safety team.</p>
        <p>This does not necessarily mean you will be disqualified. Our team will review your results and reach out within <strong>2-3 business days</strong>.</p>
        <p>If you have questions, contact us at safety@bovogo.com.</p>
        <p>— The Bovogo Safety Team</p>
      </div>
    `;
  }

  private preAdverseEmailHtml(user: User, deadline: string, candidateId: string): string {
    return `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ff6b35;">Important: Pre-Adverse Action Notice</h1>
        <p>Dear ${user.name},</p>
        
        <h2>Notice of Potential Adverse Action</h2>
        <p>Bovogo LLC has received the results of a consumer report from Checkr, Inc., a consumer reporting agency, in connection with your application to drive on the Bovogo platform.</p>
        
        <p>Based on the information in this report, we are considering taking adverse action against your application, which may include denial of driving privileges on our platform.</p>
        
        <h2>Your Rights Under the FCRA</h2>
        <p>You have the right to dispute the accuracy or completeness of any information in this report. Before we take any final action, we are providing you with:</p>
        <ul>
          <li>A copy of the consumer report from Checkr, Inc.</li>
          <li>A copy of "A Summary of Your Rights Under the Fair Credit Reporting Act"</li>
        </ul>
        
        <h2>How to Dispute</h2>
        <p>If you believe any information in the report is incorrect or incomplete, you may dispute it directly with Checkr:</p>
        <ul>
          <li><strong>Online:</strong> https://checkr.com/account/disputes</li>
          <li><strong>Phone:</strong> 1-844-823-9633</li>
          <li><strong>Mail:</strong> Checkr, Inc., 548 Market St, PMB 72294, San Francisco, CA 94104</li>
        </ul>
        <p>Checkr will investigate your dispute at no cost to you.</p>
        
        <h2>Deadline</h2>
        <p>You have until <strong>${deadline}</strong> (5 business days from the date of this notice) to respond with any additional information or dispute. If we do not hear from you by this date, we may proceed with the adverse action.</p>
        
        <p>If you have questions about this notice, contact us at safety@bovogo.com.</p>
        
        <p>Sincerely,<br>The Bovogo Safety Team</p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #666;">
          This notice is provided pursuant to the Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq.
          Consumer report provided by Checkr, Inc. Checkr candidate reference: ${candidateId}
        </p>
      </div>
    `;
  }

  private preAdverseEmailText(user: User, deadline: string): string {
    return `
Dear ${user.name},

NOTICE OF POTENTIAL ADVERSE ACTION

Bovogo LLC has received the results of a consumer report from Checkr, Inc., a consumer reporting agency, in connection with your application to drive on the Bovogo platform.

Based on the information in this report, we are considering taking adverse action against your application, which may include denial of driving privileges on our platform.

YOUR RIGHTS UNDER THE FCRA

You have the right to dispute the accuracy or completeness of any information in this report. Before we take any final action, we are providing you with a copy of the consumer report and a summary of your rights under the Fair Credit Reporting Act.

HOW TO DISPUTE

If you believe any information in the report is incorrect or incomplete, you may dispute it directly with Checkr:
- Online: https://checkr.com/account/disputes
- Phone: 1-844-823-9633
- Mail: Checkr, Inc., 548 Market St, PMB 72294, San Francisco, CA 94104

DEADLINE

You have until ${deadline} (5 business days from the date of this notice) to respond with any additional information or dispute.

If you have questions about this notice, contact us at safety@bovogo.com.

Sincerely,
The Bovogo Safety Team

This notice is provided pursuant to the Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq.
    `.trim();
  }

  private finalAdverseEmailHtml(user: User, candidateId: string): string {
    return `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ff6b35;">Adverse Action — Final Notice</h1>
        <p>Dear ${user.name},</p>
        
        <h2>Notice of Adverse Action</h2>
        <p>This notice is to inform you that after consideration of the consumer report from Checkr, Inc., and any additional information you provided, Bovogo LLC has decided to <strong>deny your application</strong> to drive on the Bovogo platform.</p>
        
        <p>This decision was based in whole or in part on information contained in a consumer report.</p>
        
        <h2>The Consumer Reporting Agency</h2>
        <p>The consumer report was provided by:</p>
        <p><strong>Checkr, Inc.</strong><br>
        548 Market St, PMB 72294<br>
        San Francisco, CA 94104<br>
        1-844-823-9633<br>
        https://checkr.com</p>
        
        <p>The consumer reporting agency did not make the decision to take adverse action and is unable to provide the specific reasons for the decision.</p>
        
        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Request a free copy of your consumer report from Checkr within 60 days</li>
          <li>Dispute the accuracy or completeness of any information in the report</li>
          <li>Add a statement of dispute to your file</li>
        </ul>
        
        <h2>Summary of Your Rights</h2>
        <p>A copy of "A Summary of Your Rights Under the Fair Credit Reporting Act" is available at: https://www.consumerfinance.gov/learnmore</p>
        
        <p>If you believe this decision was made in error, you may contact us at safety@bovogo.com.</p>
        
        <p>Sincerely,<br>The Bovogo Safety Team</p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #666;">
          This notice is provided pursuant to the Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq.
          Checkr candidate reference: ${candidateId}
        </p>
      </div>
    `;
  }

  private finalAdverseEmailText(user: User, candidateId: string): string {
    return `
Dear ${user.name},

NOTICE OF ADVERSE ACTION — FINAL NOTICE

This notice is to inform you that after consideration of the consumer report from Checkr, Inc., and any additional information you provided, Bovogo LLC has decided to DENY your application to drive on the Bovogo platform.

This decision was based in whole or in part on information contained in a consumer report.

THE CONSUMER REPORTING AGENCY

The consumer report was provided by:
Checkr, Inc.
548 Market St, PMB 72294
San Francisco, CA 94104
1-844-823-9633
https://checkr.com

The consumer reporting agency did not make the decision to take adverse action and is unable to provide the specific reasons for the decision.

YOUR RIGHTS

You have the right to:
- Request a free copy of your consumer report from Checkr within 60 days
- Dispute the accuracy or completeness of any information in the report
- Add a statement of dispute to your file

A copy of "A Summary of Your Rights Under the Fair Credit Reporting Act" is available at: https://www.consumerfinance.gov/learnmore

If you believe this decision was made in error, you may contact us at safety@bovogo.com.

Sincerely,
The Bovogo Safety Team

This notice is provided pursuant to the Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq.
Checkr candidate reference: ${candidateId}
    `.trim();
  }
}
