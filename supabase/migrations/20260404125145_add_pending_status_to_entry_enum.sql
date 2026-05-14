/*
  # Add Pending Status to Entry Enum

  1. Schema Changes
    - Add 'pending' value to entry_status enum for sebayat-initiated tickets

  2. Notes
    - Pending tickets await west gate acknowledgment
    - This must be committed before using the value in policies
*/

-- Add 'pending' to entry_status enum
ALTER TYPE entry_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'registered';