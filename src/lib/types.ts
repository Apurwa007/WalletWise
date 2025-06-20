import type { LucideIcon } from 'lucide-react';

export type FinancialGoalValue = "travel" | "savings" | "debt_reduction";

export interface FinancialGoal {
  value: FinancialGoalValue;
  label: string;
  icon: LucideIcon;
}

export interface OfferConditionDetails {
  minSpend?: number;
  maxDiscount?: number; // General max discount
  maxDiscountCredit?: number;
  maxDiscountDebit?: number;
  maxDiscountEMI?: number;
  period?: string;
  applicableOn?: string[]; // e.g., "EMI", "Specific Product"
  rawDetails?: string; // Store original complex text or specific card benefits
  bonus?: { spend: number; extra: number }[];
  cap?: number; // Overall cap for an offer if it has multiple components
}

export interface Offer {
  id: string;
  description: string; // Synthesized description for display
  type: "cashback" | "miles" | "flat_discount" | "voucher" | "bonus_reward" | "other";
  value: number; // For cashback (%), flat_discount (amount), miles (multiplier), bonus_reward (points/amount)
  valueType?: 'percentage' | 'amount' | 'multiplier' | 'points'; // Clarify what value means
  conditions?: OfferConditionDetails;
  categoryAffinity?: string[]; // e.g., "Shopping", "Travel"
  bankOfferSource?: string; // e.g., "Amazon_Card_Offers_India_2025"
  rawJsonOffer?: any; // Store the original JSON offer object
  specificCardType?: string; // e.g. "Amazon Pay ICICI Credit Card" if offer is for a specific card.
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: "credit_card" | "debit_card" | "upi" | "wallet" | "gift_card";
  bankName?: string; // e.g., "HDFC Bank", "ICICI Bank" to link with bank-level offers
  last4Digits?: string;
  upiId?: string;
  walletBalance?: number;
  usage?: number; // 0.0 to 1.0, representing credit utilization (e.g., 0.7 for 70%)
  offers?: Offer[];
}

export interface UserProfile {
  id: string;
  email: string;
  goal: FinancialGoalValue | null;
  savedPaymentMethods: PaymentMethod[];
}

export interface Transaction {
  id: string;
  amount: number;
  date: string; // ISO string date, this is the primary date for app logic
  paymentMethodUsed: Pick<PaymentMethod, "id" | "name" | "type">;
  category: string;
  offerApplied?: string; // Description of the offer used, e.g., "5% Cashback"
  savings?: number; // Monetary value of savings
  userId?: string; // To associate transaction with a user in Firestore
  createdAt?: any; // Firestore Timestamp for ordering, 'any' for simplicity here
}

// For frontend display and state
export interface SmartRecommendation {
  recommended: {
    paymentMethodId: string;
    name: string;
    offerType: string; // "cashback", "miles", "flat_discount"
    offerDisplay: string; // User-friendly offer text, e.g., "5% Cashback", "2x Miles", "₹50 Off"
    reason: string;
  };
}

// Type for the actual value of an offer that can be directly used in calculations
export type OfferValueDetails = {
  type: Offer['type'];
  value: number; // The numeric value of the offer
  description: string; // Full description for display or logging
};