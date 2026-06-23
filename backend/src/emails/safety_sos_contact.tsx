import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
  Row,
  Column,
  Hr,
  Link,
  Button,
  Img,
} from '@react-email/components';
import * as React from 'react';

interface SafetySosContactProps {
  userName: string;
  alertedUserName: string;
  alertType: string;
  originMetro?: string;
  destMetro?: string;
  mapsLink?: string;
  tripLink?: string;
  contactUsLink?: string;
}

export const SafetySosContact = ({
  userName = 'Emergency Contact',
  alertedUserName = 'John',
  alertType = 'sos',
  originMetro = 'Downtown',
  destMetro = 'Airport',
  mapsLink = 'https://maps.google.com/?q=40.7128,-74.0060',
  tripLink = 'https://bovogo.app/track/abc123',
  contactUsLink = 'https://bovogo.app/contact',
}: SafetySosContactProps) => {
  const isSos = alertType === 'sos';

  return (
    <Html>
      <Head />
      <Preview>
        {isSos ? 'SAFETY ALERT' : 'Safety notification'} for {alertedUserName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://bovogo.app/logo.png"
            width="120"
            alt="Bovogo"
            style={logo}
          />

          {isSos ? (
            <Heading style={sosHeading}>SAFETY ALERT</Heading>
          ) : (
            <Heading style={heading}>Safety Notification</Heading>
          )}

          <Text style={paragraph}>Dear {userName},</Text>

          {isSos ? (
            <Text style={alertParagraph}>
              <strong>{alertedUserName}</strong> has activated an emergency
              safety alert through the Bovogo app. They may be in an unsafe
              situation.
            </Text>
          ) : (
            <Text style={paragraph}>
              We wanted to let you know that <strong>{alertedUserName}</strong>'s
              trip has experienced a safety event. The route has deviated from the
              expected path.
            </Text>
          )}

          {(originMetro || destMetro) && (
            <Section style={tripDetails}>
              <Row>
                <Column>
                  <Text style={label}>Route</Text>
                  <Text style={value}>
                    {originMetro} → {destMetro}
                  </Text>
                </Column>
              </Row>
            </Section>
          )}

          {mapsLink && (
            <Section style={locationSection}>
              <Text style={locationTitle}>View Location</Text>
              <Button href={mapsLink} style={locationButton}>
                Open in Maps
              </Button>
            </Section>
          )}

          {tripLink && (
            <Section style={buttonSection}>
              <Button href={tripLink} style={button}>
                Track Trip
              </Button>
            </Section>
          )}

          <Hr style={hr} />

          <Section style={helpSection}>
            <Text style={helpText}>
              If you have any concerns or need to reach our Trust & Safety team,
              please contact us immediately.
            </Text>
            <Button href={contactUsLink} style={contactButton}>
              Contact Us
            </Button>
          </Section>

          <Text style={disclaimer}>
            This alert was sent because {alertedUserName} listed you as an
            emergency contact. If you believe this was sent in error, please
            contact us.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            Bovogo LLC • Safety first •{' '}
            <Link href="https://bovogo.app">bovogo.app</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default SafetySosContact;

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

const sosHeading = {
  fontSize: '32px',
  fontWeight: '700',
  color: '#ff5050',
  marginBottom: '16px',
  textAlign: 'center' as const,
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#333333',
  marginBottom: '16px',
};

const alertParagraph = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#333333',
  marginBottom: '16px',
  padding: '16px',
  backgroundColor: '#fff0f0',
  borderRadius: '8px',
  borderLeft: '4px solid #ff5050',
};

const tripDetails = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
};

const label = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#6b7d8f',
  textTransform: 'uppercase' as const,
  marginBottom: '4px',
};

const value = {
  fontSize: '16px',
  fontWeight: '500',
  color: '#0a0d0f',
  marginBottom: '0',
};

const locationSection = {
  textAlign: 'center' as const,
  marginBottom: '16px',
};

const locationTitle = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#0a0d0f',
  marginBottom: '12px',
};

const locationButton = {
  backgroundColor: '#1976d2',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
  display: 'inline-block',
};

const hr = {
  borderColor: '#e0e0e0',
  margin: '24px 0',
};

const buttonSection = {
  textAlign: 'center' as const,
  marginBottom: '16px',
};

const button = {
  backgroundColor: '#00e5a0',
  borderRadius: '8px',
  color: '#0a0d0f',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block',
};

const helpSection = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const helpText = {
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

const disclaimer = {
  fontSize: '12px',
  color: '#999999',
  fontStyle: 'italic',
  marginBottom: '16px',
};

const footer = {
  fontSize: '12px',
  color: '#999999',
  textAlign: 'center' as const,
};
