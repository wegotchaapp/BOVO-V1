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

interface TripReminder48hProps {
  userName: string;
  driverName: string;
  driverPhone: string;
  originMetro: string;
  destMetro: string;
  departureDate: string;
  departureTime: string;
  pickupZone: string;
  shareTripLink: string;
  tripLink: string;
}

export const TripReminder48h = ({
  userName = 'Rider',
  driverName = 'Driver',
  driverPhone = '(555) 123-4567',
  originMetro = 'Downtown',
  destMetro = 'Airport',
  departureDate = 'Dec 15, 2024',
  departureTime = '8:00 AM',
  pickupZone = 'Zone A - Main Street',
  shareTripLink = 'https://bovogo.app/share/abc123',
  tripLink = 'https://bovogo.app/trip/123',
}: TripReminder48hProps) => (
  <Html>
    <Head />
    <Preview>Your trip to {destMetro} departs in 48 hours!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://bovogo.app/logo.png"
          width="120"
          alt="Bovogo"
          style={logo}
        />
        <Heading style={heading}>Trip Reminder: 48 Hours</Heading>
        <Text style={paragraph}>Hi {userName},</Text>
        <Text style={paragraph}>
          Your trip to {destMetro} departs in 48 hours. Please review the
          details below and make sure you're ready.
        </Text>

        <Section style={tripDetails}>
          <Row>
            <Column>
              <Text style={label}>From</Text>
              <Text style={value}>{originMetro}</Text>
            </Column>
            <Column>
              <Text style={label}>To</Text>
              <Text style={value}>{destMetro}</Text>
            </Column>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Column>
              <Text style={label}>Date</Text>
              <Text style={value}>{departureDate}</Text>
            </Column>
            <Column>
              <Text style={label}>Time</Text>
              <Text style={value}>{departureTime}</Text>
            </Column>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Column>
              <Text style={label}>Pickup Zone</Text>
              <Text style={value}>{pickupZone}</Text>
            </Column>
          </Row>
        </Section>

        <Section style={driverSection}>
          <Row>
            <Column>
              <Text style={label}>Driver</Text>
              <Text style={value}>{driverName}</Text>
            </Column>
            <Column>
              <Text style={label}>Driver Phone</Text>
              <Text style={value}>{driverPhone}</Text>
            </Column>
          </Row>
        </Section>

        <Hr style={hr} />

        <Section style={safetySection}>
          <Heading style={safetyHeading}>Share Your Trip</Heading>
          <Text style={safetyText}>
            For your safety, share your trip details with emergency contacts.
            They'll be able to track your location during the trip.
          </Text>
          <Button href={shareTripLink} style={safetyButton}>
            Share Trip
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

export default TripReminder48h;

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

const driverSection = {
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

const hr = {
  borderColor: '#e0e0e0',
  margin: '24px 0',
};

const buttonSection = {
  textAlign: 'center' as const,
  marginBottom: '24px',
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

const safetySection = {
  backgroundColor: '#fff3e0',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '24px',
  textAlign: 'center' as const,
};

const safetyHeading = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#ff8c00',
  marginBottom: '8px',
};

const safetyText = {
  fontSize: '14px',
  color: '#333333',
  marginBottom: '16px',
};

const safetyButton = {
  backgroundColor: '#ff8c00',
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
