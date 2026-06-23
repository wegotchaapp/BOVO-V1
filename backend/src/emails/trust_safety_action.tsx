import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
  Hr,
  Link,
  Button,
  Img,
} from '@react-email/components';
import * as React from 'react';

interface TrustSafetyActionProps {
  userName: string;
  actionType: string;
  reason: string;
  reportId: string;
  appealLink?: string;
  contactUsLink: string;
}

export const TrustSafetyAction = ({
  userName = 'User',
  actionType = 'warning',
  reason = 'A report was reviewed by our Trust & Safety team.',
  reportId = 'RPT-123',
  appealLink = 'https://bovogo.app/appeal',
  contactUsLink = 'https://bovogo.app/contact',
}: TrustSafetyActionProps) => {
  const actionLabels: Record<string, string> = {
    dismiss: 'No action taken',
    warning: 'Warning issued',
    temp_suspension: 'Temporary suspension',
    permanent_ban: 'Permanent ban',
    law_enforcement_referral: 'Law enforcement referral',
  };

  const actionColors: Record<string, string> = {
    dismiss: '#2e7d32',
    warning: '#ff8c00',
    temp_suspension: '#f44336',
    permanent_ban: '#b71c1c',
    law_enforcement_referral: '#4a148c',
  };

  const color = actionColors[actionType] || '#6b7d8f';
  const label = actionLabels[actionType] || actionType;

  return (
    <Html>
      <Head />
      <Preview>Trust & Safety notification from Bovogo</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://bovogo.app/logo.png"
            width="120"
            alt="Bovogo"
            style={logo}
          />
          <Heading style={heading}>Trust & Safety Notification</Heading>
          <Text style={paragraph}>Hi {userName},</Text>
          <Text style={paragraph}>
            Our Trust & Safety team has completed a review and taken the following
            action on your account:
          </Text>

          <Section style={{ ...actionBadge, borderLeftColor: color }}>
            <Text style={{ ...actionLabel, color }}>
              {label}
            </Text>
            <Text style={actionReason}>{reason}</Text>
          </Section>

          <Text style={referenceText}>
            <strong>Reference:</strong> {reportId}
          </Text>

          <Hr style={hr} />

          {appealLink && actionType !== 'dismiss' && (
            <Section style={appealSection}>
              <Text style={appealText}>
                If you believe this action was taken in error, you have the right
                to appeal. A different Trust & Safety agent will review your case.
              </Text>
              <Button href={appealLink} style={appealButton}>
                Submit an Appeal
              </Button>
            </Section>
          )}

          <Section style={contactSection}>
            <Text style={contactText}>
              If you have questions about this decision, please contact our Trust
              & Safety team.
            </Text>
            <Button href={contactUsLink} style={contactButton}>
              Contact Us
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Bovogo LLC • Trust & Safety •{' '}
            <Link href="https://bovogo.app">bovogo.app</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default TrustSafetyAction;

const main = {
  backgroundColor: '#f5f5f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '32px 24px',
  borderRadius: '8px',
  maxWidth: '560px',
};

const logo = {
  marginBottom: '24px',
};

const heading = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#0a0d0f',
  marginBottom: '16px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#333333',
  marginBottom: '16px',
};

const actionBadge = {
  padding: '20px',
  borderRadius: '8px',
  backgroundColor: '#f8f9fa',
  borderLeft: '4px solid',
  marginBottom: '16px',
};

const actionLabel = {
  fontSize: '18px',
  fontWeight: '700',
  marginBottom: '8px',
};

const actionReason = {
  fontSize: '14px',
  color: '#6b7d8f',
  marginBottom: '0',
  lineHeight: '20px',
};

const referenceText = {
  fontSize: '13px',
  color: '#999999',
  marginBottom: '16px',
};

const hr = {
  borderColor: '#e0e0e0',
  margin: '24px 0',
};

const appealSection = {
  backgroundColor: '#fff3e0',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center' as const,
  marginBottom: '16px',
};

const appealText = {
  fontSize: '14px',
  color: '#333333',
  marginBottom: '16px',
};

const appealButton = {
  backgroundColor: '#ff8c00',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
  display: 'inline-block',
};

const contactSection = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const contactText = {
  fontSize: '14px',
  color: '#333333',
  marginBottom: '16px',
};

const contactButton = {
  backgroundColor: '#0a0d0f',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
  display: 'inline-block',
};

const footer = {
  fontSize: '12px',
  color: '#999999',
  textAlign: 'center' as const,
};
