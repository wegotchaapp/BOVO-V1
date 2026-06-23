-- Add luggage_insurance_opted_in column to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS luggage_insurance_opted_in BOOLEAN DEFAULT FALSE;
