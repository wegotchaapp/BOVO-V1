import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export interface FoundingInsurancePlaceholderProps {
  userName: string;
  role: 'rider' | 'driver';
  originMetro: string;
  destMetro: string;
  departureDate: string;
  departureTime: string;
  isFoundingMember: boolean;
  driverName?: string;
  totalPrice?: string;
  tripLink: string;
  subject?: string;
}

export const FoundingInsurancePlaceholder = ({
  userName = 'Sailor',
  role = 'rider',
  originMetro = 'Austin',
  destMetro = 'Houston',
  departureDate = 'Dec 15, 2024',
  departureTime = '8:00 AM',
  isFoundingMember = false,
  driverName = 'Voyager',
  totalPrice = '$25.00',
  tripLink = 'https://bovogo.app',
  subject,
}: FoundingInsurancePlaceholderProps) => {
  const isRider = role === 'rider';
  const headline = isRider ? 'Adventure Booked!' : 'Pre-Trip Video Received';
  const preview = isRider
    ? `Your ride to ${destMetro} is confirmed.`
    : `Your vehicle video for ${destMetro} was received.`;

  const intro = isRider
    ? 'Your carpool adventure has been booked successfully. Here are your trip details:'
    : 'Your pre-trip vehicle video was received successfully. Your adventure is ready to start when you are.';

  const insuranceLine = isFoundingMember
    ? isRider
      ? 'As a founding member, this adventure is fully insured for your peace of mind.'
      : 'As a founding member, this adventure is fully insured. You may start the ride when ready.'
    : null;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://bovogo.app/logo.png"
            width="120"
            alt="Bovogo"
            style={logo}
          />
          <Heading style={heading}>{headline}</Heading>
          <Text style={paragraph}>Hi {userName},</Text>
          <Text style={paragraph}>{intro}</Text>

          {insuranceLine ? (
            <Section style={insuranceBanner}>
              <Text style={insuranceBannerText}>{insuranceLine}</Text>
              <Text style={insuranceDisclaimer}>
                This is a founding-member benefit placeholder. Coverage details
                will be provided separately when your policy is active.
              </Text>
            </Section>
          ) : null}

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
            {isRider ? (
              <Row style={{ marginTop: 16 }}>
                <Column>
                  <Text style={label}>Your Voyager</Text>
                  <Text style={value}>{driverName}</Text>
                </Column>
                <Column>
                  <Text style={label}>Total</Text>
                  <Text style={value}>{totalPrice}</Text>
                </Column>
              </Row>
            ) : null}
          </Section>

          <Section style={buttonSection}>
            <Button href={tripLink} style={button}>
              {isRider ? 'View Adventure' : 'Open Trip'}
            </Button>
          </Section>

          <Text style={safetyNote}>
            For your safety, share your trip with emergency contacts before
            departure and use SOS in the app if you ever feel unsafe.
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
};

export default FoundingInsurancePlaceholder;

const main = {
  backgroundColor: '#f5f5f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '32px 24px',
  borderRadius: '8px',
  maxWidth: '560px',
};

const logo = { marginBottom: '24px' };

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

const insuranceBanner = {
  backgroundColor: '#EBF2ED',
  borderRadius: '8px',
  padding: '16px 20px',
  marginBottom: '16px',
  borderLeft: '4px solid #00e5a0',
};

const insuranceBannerText = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#0a0d0f',
  marginBottom: '8px',
};

const insuranceDisclaimer = {
  fontSize: '13px',
  color: '#6b7d8f',
  marginBottom: '0',
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

const hr = { borderColor: '#e0e0e0', margin: '24px 0' };

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
