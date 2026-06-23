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

interface TripReminder2hProps {
  userName: string;
  driverName: string;
  originMetro: string;
  destMetro: string;
  departureTime: string;
  pickupZone: string;
  pickupInstructions: string;
  chatLink: string;
  tripLink: string;
}

export const TripReminder2h = ({
  userName = 'Rider',
  driverName = 'Driver',
  originMetro = 'Downtown',
  destMetro = 'Airport',
  departureTime = '8:00 AM',
  pickupZone = 'Zone A - Main Street',
  pickupInstructions = 'Look for the green Bovogo sign near the main entrance.',
  chatLink = 'https://bovogo.app/chat/123',
  tripLink = 'https://bovogo.app/trip/123',
}: TripReminder2hProps) => (
  <Html>
    <Head />
    <Preview>Your trip departs in 2 hours!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://bovogo.app/logo.png"
          width="120"
          alt="Bovogo"
          style={logo}
        />
        <Heading style={heading}>Trip Departing in 2 Hours</Heading>
        <Text style={paragraph}>Hi {userName},</Text>
        <Text style={paragraph}>
          Your trip to {destMetro} departs at {departureTime}. Your driver{' '}
          {driverName} will meet you at the pickup zone.
        </Text>

        <Section style={tripDetails}>
          <Row>
            <Column>
              <Text style={label}>Pickup Zone</Text>
              <Text style={value}>{pickupZone}</Text>
            </Column>
            <Column>
              <Text style={label}>Departure</Text>
              <Text style={value}>{departureTime}</Text>
            </Column>
          </Row>
        </Section>

        <Section style={instructionsSection}>
          <Text style={instructionsTitle}>Pickup Instructions</Text>
          <Text style={instructionsText}>{pickupInstructions}</Text>
        </Section>

        <Hr style={hr} />

        <Section style={buttonSection}>
          <Button href={chatLink} style={chatButton}>
            Message Driver
          </Button>
        </Section>

        <Section style={buttonSection}>
          <Button href={tripLink} style={button}>
            View Trip Details
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Bovogo LLC • Safe carpooling •{' '}
          <Link href="https://bovogo.app">bovogo.app</Link>
        </Text>
      </Container>
    </Body>
  </Html>
);

export default TripReminder2h;

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

const tripDetails = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '20px',
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

const instructionsSection = {
  backgroundColor: '#e8f5e9',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
};

const instructionsTitle = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#2e7d32',
  marginBottom: '8px',
};

const instructionsText = {
  fontSize: '14px',
  color: '#333333',
  marginBottom: '0',
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

const chatButton = {
  backgroundColor: '#1976d2',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block',
};

const footer = {
  fontSize: '12px',
  color: '#999999',
  textAlign: 'center' as const,
};
