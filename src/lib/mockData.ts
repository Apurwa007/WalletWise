
import type { UserProfile, PaymentMethod, Transaction, FinancialGoal, Offer, OfferConditionDetails } from './types';
import { CreditCard, Landmark, PiggyBank, Plane, TrendingDown, Gift, WalletCards, IndianRupee, ShoppingBag } from 'lucide-react';
import rawAmazonOffers from './Amazon_Card_Offers_India_2025.json';

export const MOCK_USER_ID = "user_walletwise_001";

// Helper to transform raw JSON offers to our application's Offer type
function processAmazonOffers(jsonData: any[]): Offer[] {
  const allOffers: Offer[] = [];
  let offerIdCounter = 0;

  jsonData.forEach((bankEntry: any) => {
    const bankName = bankEntry.bank;
    bankEntry.offers.forEach((rawOffer: any) => {
      offerIdCounter++;
      const offerId = `bank_offer_${bankName.toLowerCase().replace(/\s+/g, '_')}_${offerIdCounter}`;
      
      let type: Offer['type'] = 'other';
      let value = 0;
      let valueType: Offer['valueType'] | undefined = undefined;
      let description = "";
      let categoryAffinity: string[] | undefined = rawOffer.categories;
      
      const conditions: OfferConditionDetails = {
        minSpend: rawOffer.minSpend,
        period: rawOffer.period,
        applicableOn: rawOffer.applicableOn,
        bonus: rawOffer.bonus,
        cap: rawOffer.cap,
        rawDetails: rawOffer.details || rawOffer.benefits || rawOffer.extra,
      };
      
      if(rawOffer.maxDiscountCredit) conditions.maxDiscountCredit = rawOffer.maxDiscountCredit;
      if(rawOffer.maxDiscountDebit) conditions.maxDiscountDebit = rawOffer.maxDiscountDebit;
      if(rawOffer.maxDiscountEMI) conditions.maxDiscountEMI = rawOffer.maxDiscountEMI;
      if(rawOffer.maxDiscount) conditions.maxDiscount = rawOffer.maxDiscount;


      if (rawOffer.card === "HDFC Millennia") {
        type = 'cashback';
        value = rawOffer.cashbackPercentAmazon || 0; // Prioritize Amazon cashback
        valueType = 'percentage';
        description = `${value}% cashback on Amazon`; // Simplified description
        categoryAffinity = ["Shopping", "Amazon Prime", "Electronics", "Mobiles"]; // Broad assumption
        // Note: HDFC Millennia in JSON has no max cap defined. Code can't apply a cap not in data.
        if (rawOffer.cashbackPercentGiftCard && value === 0) { // Fallback if Amazon one isn't primary
             value = rawOffer.cashbackPercentGiftCard;
             description = `${value}% cashback on Gift Cards`;
             categoryAffinity = ["Shopping"]; // Example category
        }

      } else if (rawOffer.discountPercent) {
        type = 'cashback';
        value = rawOffer.discountPercent;
        valueType = 'percentage';
        description = `${value}% off`;
      } else if (rawOffer.offerType?.toLowerCase().includes("voucher")) {
        type = 'voucher';
        value = 0; 
        description = rawOffer.offerType;
      } else if (rawOffer.benefits?.toLowerCase().includes("cashback") || rawOffer.extra?.toLowerCase().includes("cashback")) {
        type = 'cashback';
        const cashbackMatch = (rawOffer.benefits || rawOffer.extra || "").match(/(\d+)% cashback/i);
        if (cashbackMatch) value = parseFloat(cashbackMatch[1]);
        else value = 0; 
        valueType = 'percentage';
        description = rawOffer.benefits || rawOffer.extra || "Cashback offer";
         const maxCashbackMatch = (rawOffer.extra || "").match(/up to ₹(\d+)/i);
         if (maxCashbackMatch && !conditions.maxDiscount) conditions.maxDiscount = parseFloat(maxCashbackMatch[1]);
      } else if (rawOffer.extra?.toLowerCase().includes("flat") || rawOffer.extra?.toLowerCase().includes("off")) {
        type = 'flat_discount';
        const flatOffMatch = rawOffer.extra.match(/₹(\d+)/);
        if (flatOffMatch) value = parseFloat(flatOffMatch[1]);
        valueType = 'amount';
        description = rawOffer.extra;
      } else if (rawOffer.offerType?.toLowerCase().includes("rewards") || rawOffer.details?.toLowerCase().includes("points")) {
        type = 'bonus_reward';
        value = 0; 
        valueType = 'points';
        description = rawOffer.offerType || "Bonus Rewards";
      } else {
        description = rawOffer.offerType || rawOffer.details || "Special Offer";
      }

      let fullDescription = description;
      if (conditions.minSpend) fullDescription += `, min spend ₹${conditions.minSpend}`;
      
      let appliedMaxDiscountForDesc: number | undefined = undefined;
      const cardTypesLower = bankEntry.cardTypes.map((ct:string) => ct.toLowerCase());

      if (cardTypesLower.includes("credit card") && conditions.maxDiscountCredit) {
        appliedMaxDiscountForDesc = conditions.maxDiscountCredit;
        fullDescription += `, max discount ₹${conditions.maxDiscountCredit} (Credit)`;
      } else if (cardTypesLower.includes("debit card") && conditions.maxDiscountDebit) {
         appliedMaxDiscountForDesc = conditions.maxDiscountDebit;
        fullDescription += `, max discount ₹${conditions.maxDiscountDebit} (Debit)`;
      } else if (conditions.maxDiscountEMI && rawOffer.applicableOn?.includes("EMI")) {
        // We generally don't show EMI caps in this concise string unless it's the only one
      } else if (conditions.maxDiscount && appliedMaxDiscountForDesc === undefined) {
        // Only add general maxDiscount if a specific one wasn't already added
        fullDescription += `, max discount ₹${conditions.maxDiscount}`;
      }
      
      allOffers.push({
        id: offerId,
        description: fullDescription.trim(), // This is the synthesized description the AI sees, period excluded for UI.
        type,
        value,
        valueType,
        conditions, // Full conditions (including period) are still passed to AI
        categoryAffinity: categoryAffinity,
        bankOfferSource: "Amazon_Card_Offers_India_2025",
        rawJsonOffer: rawOffer,
        specificCardType: rawOffer.card, 
      });
    });
  });
  return allOffers;
}

export const processedBankOffers = processAmazonOffers(rawAmazonOffers);

// Helper to link saved payment methods to processed bank offers
function getOffersForPaymentMethod(pm: Omit<PaymentMethod, 'offers'>): Offer[] {
  if (!pm.bankName) return [];
  
  return processedBankOffers.filter(offer => {
    const jsonBankEntry = rawAmazonOffers.find(b => b.bank === pm.bankName);
    if (!jsonBankEntry) return false;

    if (offer.specificCardType && pm.name !== offer.specificCardType && pm.name !== offer.specificCardType.replace(" CC", " Credit Card")) {
        return false;
    }
    
    if (!offer.specificCardType) {
        let cardTypeMatch = false;
        const offerCardTypes = jsonBankEntry.cardTypes.map((ct: string) => ct.toLowerCase());

        if (pm.type === "credit_card" && (offerCardTypes.includes("credit card") || offerCardTypes.includes("all sbi credit cards (ex corporate, cashback, paytm)") || offerCardTypes.includes("credit card emi"))) {
            cardTypeMatch = true;
        } else if (pm.type === "debit_card" && (offerCardTypes.includes("debit card") || offerCardTypes.includes("debit card emi"))) {
            cardTypeMatch = true;
        }
        if (!cardTypeMatch) return false;
    }
    
    return true;
  });
}


export const mockPaymentMethods: PaymentMethod[] = [
  { 
    id: "pm_hdfc_regalia_cc", 
    name: "HDFC Regalia Gold CC", 
    type: "credit_card", 
    bankName: "HDFC Bank",
    last4Digits: "1234", 
    usage: 0.7,
    offers: [] 
  },
  { 
    id: "pm_icici_amazon_cc", 
    name: "Amazon Pay ICICI Credit Card", 
    type: "credit_card", 
    bankName: "ICICI Bank",
    last4Digits: "5678", 
    usage: 0.3,
    offers: [] 
  },
  { 
    id: "pm_sbi_click_cc",
    name: "SBI SimplyCLICK CC",
    type: "credit_card",
    bankName: "SBI Card",
    last4Digits: "9012",
    usage: 0.9, 
    offers: []
  },
  { 
    id: "pm_federal_debit",
    name: "Federal Bank Debit Card",
    type: "debit_card",
    bankName: "Federal Bank",
    last4Digits: "1122",
    offers: []
  },
  { 
    id: "pm_axis_credit",
    name: "Axis Bank Credit Card",
    type: "credit_card",
    bankName: "Axis Bank",
    last4Digits: "3344",
    usage: 0.4,
    offers: []
  },
  { 
    id: "pm_paytm_wallet", 
    name: "Paytm Wallet", 
    type: "wallet", 
    offers: [{
      id: "paytm_generic_bill_offer",
      description: "₹10 off on bill payments over ₹200 via Paytm Wallet",
      type: "flat_discount",
      value: 10,
      valueType: "amount",
      conditions: { minSpend: 200, period: "Ongoing" }, 
      categoryAffinity: ["Bills"]
    }]
  },
  { 
    id: "pm_gpay_upi", 
    name: "UPI", 
    type: "upi", 
    upiId: "user@okhdfcbank",
    offers: [] 
  },
  { 
    id: "pm_amazon_pay_wallet", 
    name: "Amazon Pay", 
    type: "wallet", 
    walletBalance: 750.00,
    offers: []
  },
];

mockPaymentMethods.forEach(pm => {
  const bankOffers = getOffersForPaymentMethod(pm);
  if (!Array.isArray(pm.offers)) {
    pm.offers = [];
  }
  pm.offers = pm.offers.concat(bankOffers);
});


export const mockUserProfile: UserProfile = {
  id: MOCK_USER_ID,
  email: "demo.user@walletwise.com",
  goal: "savings", 
  savedPaymentMethods: mockPaymentMethods,
};

// Ensure current year for dynamic date generation
const currentYear = new Date().getFullYear();

export const mockTransactions: Transaction[] = [
  { 
    id: "txn_may_1", 
    amount: 3200, 
    date: new Date(currentYear, 4, 15).toISOString(), // May 15
    paymentMethodUsed: { id: "pm_hdfc_regalia_cc", name: "HDFC Regalia Gold CC", type: "credit_card" }, 
    category: "Groceries", 
    offerApplied: "5% Cashback on HDFC",
    savings: 160 
  },
  { 
    id: "txn_apr_1", 
    amount: 7500, 
    date: new Date(currentYear, 3, 20).toISOString(), // April 20
    paymentMethodUsed: { id: "pm_axis_credit", name: "Axis Bank Credit Card", type: "credit_card" }, 
    category: "Electronics",
    offerApplied: "7.5% off on Axis CC", 
    savings: 562.5
  },
  { 
    id: "txn_mar_1", 
    amount: 1200, 
    date: new Date(currentYear, 2, 10).toISOString(), // March 10
    paymentMethodUsed: { id: "pm_paytm_wallet", name: "Paytm Wallet", type: "wallet" }, 
    category: "Shopping",
    offerApplied: "₹10 off on bill payments", 
    savings: 10
  },
  { 
    id: "txn_feb_1", 
    amount: 25000, 
    date: new Date(currentYear, 1, 25).toISOString(), // February 25
    paymentMethodUsed: { id: "pm_sbi_click_cc", name: "SBI SimplyCLICK CC", type: "credit_card" }, 
    category: "Travel",
    offerApplied: "Bonus Points", 
    savings: 0 // Example: points offer, no direct monetary saving for this transaction record
  },
  { 
    id: "txn_jan_1", 
    amount: 6000, 
    date: new Date(currentYear, 0, 5).toISOString(), // January 5
    paymentMethodUsed: { id: "pm_federal_debit", name: "Federal Bank Debit Card", type: "debit_card" }, 
    category: "Electronics",
    offerApplied: "10% off, min spend ₹5000, max discount ₹750 (Debit)", 
    savings: 600
  },
  { 
    id: "txn_1", 
    amount: 2500, 
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), 
    paymentMethodUsed: { id: "pm_icici_amazon_cc", name: "Amazon Pay ICICI Credit Card", type: "credit_card" }, 
    category: "Shopping", 
    offerApplied: "5% Cashback",
    savings: 100 
  },
  { 
    id: "txn_2", 
    amount: 15000, 
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), 
    paymentMethodUsed: { id: "pm_hdfc_regalia_cc", name: "HDFC Regalia Gold CC", type: "credit_card" }, 
    category: "Travel",
    offerApplied: "2x Miles", 
    savings: 0 
  },
  { 
    id: "txn_3", 
    amount: 5000, 
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), 
    paymentMethodUsed: { id: "pm_federal_debit", name: "Federal Bank Debit Card", type: "debit_card" }, 
    category: "Electronics",
    offerApplied: "10% off, min spend ₹5000, max discount ₹1000 (Debit)", 
    savings: 500
  },
];

export const financialGoals: FinancialGoal[] = [
  { value: "savings", label: "Maximize Savings", icon: PiggyBank },
  { value: "travel", label: "Earn Travel Rewards", icon: Plane },
  { value: "debt_reduction", label: "Reduce Debt/Costs", icon: TrendingDown },
];

export const transactionCategories = ["All", "Electronics", "Groceries", "Travel", "Shopping", "Pharmacy", "Amazon Prime", "Bills"];


export const mockMonthlySavings = [
  { month: "Jan", savings: 250 },
  { month: "Feb", savings: 400 },
  { month: "Mar", savings: 300 },
  { month: "Apr", savings: 500 },
  { month: "May", savings: 450 },
  { month: "Jun", savings: 600 },
];

export const getPaymentMethodDisplayDetails = (type: PaymentMethod['type']) => {
    switch (type) {
        case 'credit_card': return { icon: CreditCard, label: "Credit Card" };
        case 'debit_card': return { icon: CreditCard, label: "Debit Card" }; 
        case 'upi': return { icon: IndianRupee, label: "UPI" };
        case 'wallet': return { icon: WalletCards, label: "Wallet" };
        case 'gift_card': return { icon: Gift, label: "Gift Card" };
        default: return { icon: ShoppingBag, label: "Payment Method" };
    }
};

