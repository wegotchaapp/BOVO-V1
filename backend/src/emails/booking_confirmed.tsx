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

interface BookingConfirmedProps {
  userName: string;
  driverName: string;
  originMetro: string;
  destMetro: string;
  departureDate: string;
  departureTime: string;
  pickupZone: string;
  totalPrice: string;
  tripLink: string;
  cancellationPolicy: string;
}

export const BookingConfirmed = ({
  userName = 'Rider',
  driverName = 'Driver',
  originMetro = 'Downtown',
  destMetro = 'Airport',
  departureDate = 'Dec 15, 2024',
  departureTime = '8:00 AM',
  pickupZone = 'Zone A - Main Street',
  totalPrice = '$25.00',
  tripLink = 'https://bovogo.app/trip/123',
  cancellationPolicy = 'Free cancellation up to 24 hours before departure.',
}: BookingConfirmedProps) => (
  <Html>
    <Head />
    <Preview>Your trip to {destMetro} is confirmed!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://bovogo.app/logo.png"
          width="120"
          alt="Bovogo"
          style={logo}
        />
        <Heading style={heading}>Trip Confirmed!</Heading>
        <Text style={paragraph}>Hi {userName},</Text>
        <Text style={paragraph}>
          Your carpool trip has been confirmed. Here are your trip details:
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
            <Column>
              <Text style={label}>Total Price</Text>
              <Text style={value}>{totalPrice}</Text>
            </Column>
          </Row>
        </Section>

        <Section style={driverSection}>
          <Text style={label}>Your Driver</Text>
          <Text style={value}>{driverName}</Text>
        </Section>

        <Hr style={hr} />

        <Section style={buttonSection}>
          <Button href={tripLink} style={button}>
            View Trip Details
          </Button>
        </Section>

        <Text style={cancellationPolicyStyle}>
          <strong>Cancellation Policy:</strong> {cancellationPolicy}
        </Text>

        <Text style={safetyNote}>
          For your safety, you can share your trip with emergency contacts once
          the trip is active.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Bovogo LLC • Safe carpooling •{' '}
          <Link href="https://bovogo.app">bovogo.app</Link>
        </Text>
      </Container>
    </Body>
  </Html>
);

export default BookingConfirmed;

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

const cancellationPolicyStyle = {
  fontSize: '14px',
  color: '#6b7d8f',
  marginBottom: '12px',
};

const safetyNote = {
  fontSize: '13px',
  color: '#6b7d8f',
  fontStyle: 'italic',
  marginBottom: '16px',
};

const footer = {
  fontSize: '12px',
  color: '#999999',
  textAlign: 'center' as const,
};
