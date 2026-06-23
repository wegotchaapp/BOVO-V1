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

interface PaymentReceiptProps {
  userName: string;
  tripId: string;
  originMetro: string;
  destMetro: string;
  departureDate: string;
  driverName: string;
  baseFare: string;
  seatCount: string;
  luggageFees: string;
  insuranceFee: string;
  platformFee: string;
  totalAmount: string;
  paymentMethod: string;
  receiptDate: string;
  refundPolicy: string;
}

export const PaymentReceipt = ({
  userName = 'Rider',
  tripId = 'ABC123',
  originMetro = 'Downtown',
  destMetro = 'Airport',
  departureDate = 'Dec 15, 2024',
  driverName = 'John D.',
  baseFare = '$20.00',
  seatCount = '1',
  luggageFees = '$3.00',
  insuranceFee = '$5.00',
  platformFee = '$1.40',
  totalAmount = '$29.40',
  paymentMethod = 'Visa ending in 4242',
  receiptDate = 'Dec 10, 2024',
  refundPolicy = 'Full refund if cancelled 24+ hours before departure.',
}: PaymentReceiptProps) => (
  <Html>
    <Head />
    <Preview>Payment receipt for your trip to {destMetro}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://bovogo.app/logo.png"
          width="120"
          alt="Bovogo"
          style={logo}
        />
        <Heading style={heading}>Payment Receipt</Heading>
        <Text style={paragraph}>Hi {userName},</Text>
        <Text style={paragraph}>
          Here is your payment receipt for the trip to {destMetro}.
        </Text>

        <Section style={receiptHeader}>
          <Row>
            <Column>
              <Text style={label}>Receipt Date</Text>
              <Text style={value}>{receiptDate}</Text>
            </Column>
            <Column>
              <Text style={label}>Trip ID</Text>
              <Text style={value}>{tripId}</Text>
            </Column>
          </Row>
        </Section>

        <Section style={itemizedSection}>
          <Heading style={itemizedHeading}>Cost Breakdown</Heading>

          <Row style={itemRow}>
            <Column style={itemLabel}>Base Fare ({seatCount} seat)</Column>
            <Column style={itemValue} align="right">{baseFare}</Column>
          </Row>
          <Row style={itemRow}>
            <Column style={itemLabel}>Luggage Fees</Column>
            <Column style={itemValue} align="right">{luggageFees}</Column>
          </Row>
          <Row style={itemRow}>
            <Column style={itemLabel}>Trip Insurance</Column>
            <Column style={itemValue} align="right">{insuranceFee}</Column>
          </Row>
          <Row style={itemRow}>
            <Column style={itemLabel}>Platform Fee</Column>
            <Column style={itemValue} align="right">{platformFee}</Column>
          </Row>

          <Hr style={itemHr} />

          <Row style={totalRow}>
            <Column style={totalLabel}>Total</Column>
            <Column style={totalValue} align="right">{totalAmount}</Column>
          </Row>
        </Section>

        <Section style={paymentSection}>
          <Text style={label}>Payment Method</Text>
          <Text style={value}>{paymentMethod}</Text>
        </Section>

        <Section style={driverSection}>
          <Text style={label}>Driver</Text>
          <Text style={value}>{driverName}</Text>
          <Text style={subtext}>Route: {originMetro} → {destMetro} on {departureDate}</Text>
        </Section>

        <Hr style={hr} />

        <Text style={refundText}>
          <strong>Refund Policy:</strong> {refundPolicy}
        </Text>

        <Text style={costShareNote}>
          Bovogo uses IRS cost-sharing guidelines to ensure carpooling
          remains affordable and compliant.
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

export default PaymentReceipt;

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

const receiptHeader = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
};

const itemizedSection = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '16px',
};

const itemizedHeading = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#0a0d0f',
  marginTop: '0',
  marginBottom: '16px',
};

const itemRow = {
  marginBottom: '8px',
};

const itemLabel = {
  fontSize: '14px',
  color: '#6b7d8f',
};

const itemValue = {
  fontSize: '14px',
  fontWeight: '500',
  color: '#0a0d0f',
};

const itemHr = {
  borderColor: '#e0e0e0',
  margin: '12px 0',
};

const totalRow = {
  marginTop: '8px',
};

const totalLabel = {
  fontSize: '16px',
  fontWeight: '700',
  color: '#0a0d0f',
};

const totalValue = {
  fontSize: '18px',
  fontWeight: '700',
  color: '#00e5a0',
};

const paymentSection = {
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

const subtext = {
  fontSize: '13px',
  color: '#6b7d8f',
  marginTop: '4px',
};

const hr = {
  borderColor: '#e0e0e0',
  margin: '24px 0',
};

const refundText = {
  fontSize: '14px',
  color: '#6b7d8f',
  marginBottom: '12px',
};

const costShareNote = {
  fontSize: '13px',
  color: '#6b7d8f',
  fontStyle: 'italic',
};

const footer = {
  fontSize: '12px',
  color: '#999999',
  textAlign: 'center' as const,
};
