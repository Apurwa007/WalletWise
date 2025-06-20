
// @ts-nocheck
"use server";

import { z } from "zod";
import { getSmartPaymentSuggestion as getAISuggestion } from "@/ai/flows/smart-payment-suggestion";
import type { SmartPaymentSuggestionInput, SmartPaymentSuggestionOutput } from "@/ai/flows/smart-payment-suggestion";
import type { FinancialGoalValue, SmartRecommendation, UserProfile, PaymentMethod, Transaction, Offer } from "./types";
import { MOCK_USER_ID, mockUserProfile, financialGoals as defaultFinancialGoals } from "./mockData";
import { revalidatePath } from 'next/cache';
import { firestore } from './firebase'; 
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';

const RecommendationFormSchema = z.object({
  userId: z.string(),
  cartTotal: z.coerce.number().min(0, "Cart total must be positive"),
  category: z.string().optional(),
});

export async function getRecommendationAction(
  prevState: SmartRecommendation | { error: string } | null,
  formData: FormData
): Promise<SmartRecommendation | { error: string }> {
  const validatedFields = RecommendationFormSchema.safeParse({
    userId: formData.get("userId"),
    cartTotal: formData.get("cartTotal"),
    category: formData.get("category") || undefined,
  });

  if (!validatedFields.success) {
    const errorPath = validatedFields.error.flatten().fieldErrors;
    const errorMessage = errorPath.cartTotal?.[0] || errorPath.userId?.[0] || "Invalid input.";
    console.error("getRecommendationAction validation error:", errorMessage, validatedFields.error.flatten());
    return { error: errorMessage };
  }

  const input: SmartPaymentSuggestionInput = validatedFields.data;

  try {
    const aiOutput: SmartPaymentSuggestionOutput = await getAISuggestion(input);

    if (!aiOutput || !aiOutput.recommended) {
        console.error("AI output is missing 'recommended' field or is null/undefined:", aiOutput);
        throw new Error("AI failed to provide a recommendation structure.");
    }
    
    const recommendation: SmartRecommendation = {
      recommended: {
        paymentMethodId: aiOutput.recommended.paymentMethodId,
        name: aiOutput.recommended.name,
        offerType: aiOutput.recommended.offerType,
        offerDisplay: aiOutput.recommended.offerDisplay,
        reason: aiOutput.recommended.reason,
      },
    };
    return recommendation;
  } catch (error) {
    console.error("Error in getRecommendationAction calling getAISuggestion:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to get AI recommendation. Please try again.";
    return { error: errorMessage };
  }
}

export async function updateUserGoalAction(userId: string, goal: FinancialGoalValue): Promise<{ success: boolean; message: string; updatedProfile?: UserProfile }> {
  if (userId === MOCK_USER_ID) {
    const currentProfile = mockUserProfile; // This still mutates the in-memory mockUserProfile
    currentProfile.goal = goal;
    console.log(`Updated goal for user ${userId} to ${goal}`);
    revalidatePath('/profile');
    revalidatePath('/dashboard');
    return { success: true, message: `Financial goal updated to ${defaultFinancialGoals.find(g => g.value === goal)?.label || goal}.`, updatedProfile: { ...currentProfile } };
  }
  return { success: false, message: "User not found." };
}

export async function addPaymentMethodAction(userId: string, formData: Omit<PaymentMethod, 'id' | 'offers' | 'usage'>): Promise<{ success: boolean; message: string; updatedProfile?: UserProfile }> {
  if (userId === MOCK_USER_ID) {
    const currentProfile = mockUserProfile; // Mutates in-memory mockUserProfile
    const newPaymentMethod: PaymentMethod = {
        id: `pm_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
        name: formData.name,
        type: formData.type,
        bankName: formData.bankName,
        last4Digits: formData.type === "credit_card" || formData.type === "debit_card" ? formData.last4Digits : undefined,
        upiId: formData.type === "upi" ? formData.upiId : undefined,
        walletBalance: (formData.type === "wallet" || formData.type === "gift_card") && formData.walletBalance !== undefined ? formData.walletBalance : undefined,
        offers: [], // Offers should be populated from mockData based on bankName if needed
        usage: formData.type === 'credit_card' ? 0 : undefined,
    };
    currentProfile.savedPaymentMethods.push(newPaymentMethod);
    console.log(`Adding payment method for user ${userId}:`, newPaymentMethod.name);
    revalidatePath('/profile');
    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, message: `${newPaymentMethod.name} added successfully.`, updatedProfile: { ...currentProfile } };
  }
  return { success: false, message: "User not found." };
}

export async function removePaymentMethodAction(userId: string, paymentMethodId: string): Promise<{ success: boolean; message: string; updatedProfile?: UserProfile }> {
  if (userId === MOCK_USER_ID) {
    const currentProfile = mockUserProfile; // Mutates in-memory mockUserProfile
    const initialLength = currentProfile.savedPaymentMethods.length;
    currentProfile.savedPaymentMethods = currentProfile.savedPaymentMethods.filter(pm => pm.id !== paymentMethodId);

    if (currentProfile.savedPaymentMethods.length < initialLength) {
      console.log(`Removing payment method ${paymentMethodId} for user ${userId}`);
      revalidatePath('/profile');
      revalidatePath('/');
      revalidatePath('/dashboard');
      return { success: true, message: `Payment method removed.`, updatedProfile: { ...currentProfile } };
    }
    return { success: false, message: "Payment method not found to remove." };
  }
  return { success: false, message: "User not found." };
}

function calculateSavingsForTransaction(cartTotal: number, paymentMethod: PaymentMethod, offerAppliedByAI?: { offerDisplay: string, offerType: string }): { savings?: number; offerDescription?: string } {
  if (!paymentMethod.offers || paymentMethod.offers.length === 0) return {};

  let bestOffer: Offer | undefined = undefined;

  if (offerAppliedByAI?.offerDisplay && offerAppliedByAI?.offerType) {
    bestOffer = paymentMethod.offers.find(o => 
        (o.description.toLowerCase().includes(offerAppliedByAI.offerDisplay.toLowerCase().split(',')[0]) || 
         o.id.toLowerCase().includes(offerAppliedByAI.offerType.toLowerCase())) && 
        (o.type === 'cashback' || o.type === 'flat_discount')
    );
  }

  if (!bestOffer) {
    let highestSavings = -1;
    for (const offer of paymentMethod.offers) {
      if (offer.type === 'cashback' || offer.type === 'flat_discount') {
        let currentSavings = 0;
        if (offer.conditions?.minSpend && cartTotal < offer.conditions.minSpend) {
            continue;
        }

        if (offer.type === "cashback" && offer.valueType === "percentage" && offer.value) {
          currentSavings = (cartTotal * offer.value) / 100;
          let maxDiscount = offer.conditions?.maxDiscount;
          if (paymentMethod.type === "credit_card" && offer.conditions?.maxDiscountCredit) {
            maxDiscount = offer.conditions.maxDiscountCredit;
          } else if (paymentMethod.type === "debit_card" && offer.conditions?.maxDiscountDebit) {
            maxDiscount = offer.conditions.maxDiscountDebit;
          }
          if (maxDiscount !== undefined && currentSavings > maxDiscount) {
            currentSavings = maxDiscount;
          }
        } else if (offer.type === "flat_discount" && offer.valueType === "amount" && offer.value) {
           currentSavings = offer.value;
        }

        if (currentSavings > highestSavings) {
          highestSavings = currentSavings;
          bestOffer = offer;
        }
      }
    }
  }

  if (!bestOffer) return { offerDescription: "Standard Payment / Non-monetary offer" };

  let savings = 0;
  if (bestOffer.type === "cashback" && bestOffer.valueType === "percentage" && bestOffer.value) {
    savings = (cartTotal * bestOffer.value) / 100;
    let maxDiscount = bestOffer.conditions?.maxDiscount;
    if (paymentMethod.type === "credit_card" && bestOffer.conditions?.maxDiscountCredit) {
      maxDiscount = bestOffer.conditions.maxDiscountCredit;
    } else if (paymentMethod.type === "debit_card" && bestOffer.conditions?.maxDiscountDebit) {
      maxDiscount = bestOffer.conditions.maxDiscountDebit;
    }
    if (maxDiscount !== undefined && savings > maxDiscount) {
      savings = maxDiscount;
    }
  } else if (bestOffer.type === "flat_discount" && bestOffer.valueType === "amount" && bestOffer.value) {
    if (!bestOffer.conditions?.minSpend || cartTotal >= bestOffer.conditions.minSpend) {
        savings = bestOffer.value;
    }
  }
  
  savings = Math.max(0, savings);

  return { savings: savings > 0 ? savings : undefined, offerDescription: bestOffer.description };
}

export async function logTransactionAction(
  userId: string,
  cartTotal: number,
  selectedPaymentMethodId: string,
  purchaseCategory: string,
  recommendation: SmartRecommendation | null
): Promise<{success: boolean, message: string, newTransactionId?: string, error?: string}> {
  if (!firestore) {
    const errorMsg = "CRITICAL: Firestore is not initialized in logTransactionAction. Check Firebase configuration and initialization in src/lib/firebase.ts";
    console.error(errorMsg);
    return { success: false, message: "Database connection error. Please contact support.", error: "Firestore not initialized" };
  }

  if (userId !== MOCK_USER_ID) {
    return { success: false, message: "User not found." };
  }

  const user = mockUserProfile; 
  const paymentMethodUsed = user.savedPaymentMethods.find(pm => pm.id === selectedPaymentMethodId);

  if (!paymentMethodUsed) {
    return { success: false, message: "Selected payment method not found." };
  }

  const aiRecommendedThisMethod = recommendation && recommendation.recommended.paymentMethodId === selectedPaymentMethodId;
  const { savings, offerDescription } = calculateSavingsForTransaction(
      cartTotal, 
      paymentMethodUsed, 
      aiRecommendedThisMethod ? recommendation.recommended : undefined
  );

  const transactionDataToSave: Omit<Transaction, 'id' | 'createdAt'> & { userId: string; createdAt: any } = {
      date: new Date().toISOString(), 
      amount: cartTotal,
      paymentMethodUsed: { id: paymentMethodUsed.id, name: paymentMethodUsed.name, type: paymentMethodUsed.type },
      category: purchaseCategory,
      offerApplied: offerDescription,
      savings: savings,
      userId: userId,
      createdAt: serverTimestamp() 
  };

  try {
    const docRef = await addDoc(collection(firestore, "transactions"), transactionDataToSave);
    console.log("Transaction logged to Firestore with ID: ", docRef.id);

    let successMessage = `Paid ₹${cartTotal.toFixed(2)} using ${paymentMethodUsed.name}.`;
    if (savings && savings > 0) {
      successMessage += ` You saved ₹${savings.toFixed(2)}!`;
    } else if (offerDescription && offerDescription !== "Standard Payment / Non-monetary offer" && !offerDescription.toLowerCase().includes("standard payment")) {
      successMessage += ` Offer: ${offerDescription}.`;
    }

    revalidatePath('/dashboard');
    revalidatePath('/'); 

    return { success: true, message: successMessage, newTransactionId: docRef.id };

  } catch (error: any) {
    console.error("CRITICAL: Error logging transaction to Firestore:", error);
    let clientErrorMessage = "Failed to save transaction to database. Please check server logs.";
    if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission denied'))) {
        clientErrorMessage = "Database permission denied. Ensure Firestore security rules allow writes to the 'transactions' collection for authenticated users or for your current setup.";
        console.error("Firestore Permission Denied Detail: Ensure your Firestore security rules (firebase.rules or in Console) allow 'create' or 'write' operations on the 'transactions' path for the user context you are operating under (MOCK_USER_ID).");
    } else if (error.message && error.message.toLowerCase().includes("offline")) {
        clientErrorMessage = "Cannot connect to database. Check internet connection or Firestore status.";
    } else if (error.message && error.message.toLowerCase().includes("quota exceeded")) {
        clientErrorMessage = "Database quota exceeded. Please check your Firebase project plan and usage.";
    }
    return { success: false, message: clientErrorMessage, error: error.message || String(error) };
  }
}

export async function getMockUserProfileServer(): Promise<UserProfile> {
  await new Promise(resolve => setTimeout(resolve, 50)); 
  return JSON.parse(JSON.stringify(mockUserProfile));
}

export async function getMockTransactionsServer(): Promise<Transaction[]> {
  console.log("Attempting to fetch transactions from Firestore for dashboard...");
  if (!firestore) {
    const errorMsg = "CRITICAL: Firestore is not initialized for getMockTransactionsServer. Check Firebase configuration and initialization in src/lib/firebase.ts";
    console.error(errorMsg);
    console.warn("Firestore not available, returning empty transaction list for dashboard.");
    return [];
  }

  try {
    const transactionsCol = collection(firestore, "transactions");
    const q = query(transactionsCol, where("userId", "==", MOCK_USER_ID), orderBy("createdAt", "desc"));

    const querySnapshot = await getDocs(q);
    console.log(`Firestore query for userId '${MOCK_USER_ID}' returned ${querySnapshot.docs.length} documents.`);

    const transactions: Transaction[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      let transactionDateString: string;
      if (typeof data.date === 'string') {
        transactionDateString = data.date;
      } else if (data.createdAt instanceof Timestamp) { // Firestore Timestamps should be converted
         transactionDateString = data.createdAt.toDate().toISOString(); 
      } else if (data.date instanceof Timestamp) { // Also handle if 'date' field is a Timestamp
         transactionDateString = data.date.toDate().toISOString();
      } else {
        console.warn(`Transaction doc.id ${doc.id} missing valid date or createdAt Timestamp. Using current date as fallback.`);
        transactionDateString = new Date().toISOString();
      }

      transactions.push({
        id: doc.id,
        amount: data.amount,
        date: transactionDateString, // Ensure this is a valid ISO string
        paymentMethodUsed: data.paymentMethodUsed, // Assumes this matches Pick<PaymentMethod, "id" | "name" | "type">
        category: data.category,
        offerApplied: data.offerApplied,
        savings: data.savings, // Ensure this is a number or undefined
      } as Transaction); // Type assertion
    });
    
    if (transactions.length === 0 && querySnapshot.docs.length > 0) {
        console.warn("Firestore returned documents, but the transactions array is empty after processing. Check data transformation logic and if `date` field is valid in Firestore documents.");
    } else if (querySnapshot.docs.length === 0) {
         console.log(`Firestore: No transactions found matching userId: ${MOCK_USER_ID}. This is normal if none are saved or if rules prevent reads.`);
    }
    return transactions;
  } catch (error: any) {
      console.error("CRITICAL: Error fetching transactions from Firestore for dashboard:", error);
    let consoleMessage = "Failed to fetch transactions from database for dashboard. This could be due to Firestore security rules (reads) or a connection issue. Returning empty array.";
     if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission denied'))) {
        consoleMessage = "Firestore permission denied for reading transactions. Please check security rules.";
        console.error("Firestore Permission Denied Detail: Ensure your Firestore security rules (firebase.rules or in Console) allow 'list' or 'read' operations on the 'transactions' path for the user context (MOCK_USER_ID).");
    } else if (error.code === 'failed-precondition' && error.message && error.message.toLowerCase().includes('requires an index')) {
        consoleMessage = `Firestore query requires an index. The error message should contain a link to create it: ${error.message}`;
        console.error(consoleMessage);
    }
    console.warn(consoleMessage);
    return []; 
  }
}


export async function addSampleTransactionsToFirestoreAction(): Promise<{ success: boolean; message: string; count: number }> {
  if (!firestore) {
    return { success: false, message: "Firestore not initialized. Cannot add sample transactions.", count: 0 };
  }

  const currentYear = new Date().getFullYear();
  const sampleTransactions = [
    // January
    { date: new Date(currentYear, 0, 5).toISOString(), amount: 6000, paymentMethodUsed: { id: "pm_federal_debit", name: "Federal Bank Debit Card", type: "debit_card" }, category: "Electronics", offerApplied: "10% off", savings: 600 },
    { date: new Date(currentYear, 0, 15).toISOString(), amount: 1500, paymentMethodUsed: { id: "pm_gpay_upi", name: "UPI", type: "upi", upiId: "user@okhdfcbank" }, category: "Groceries", offerApplied: "None", savings: 0 },
    { date: new Date(currentYear, 0, 25).toISOString(), amount: 12000, paymentMethodUsed: { id: "pm_sbi_click_cc", name: "SBI SimplyCLICK CC", type: "credit_card" }, category: "Travel", offerApplied: "Points", savings: 0 },

    // February
    { date: new Date(currentYear, 1, 5).toISOString(), amount: 2500, paymentMethodUsed: { id: "pm_icici_amazon_cc", name: "Amazon Pay ICICI Credit Card", type: "credit_card" }, category: "Shopping", offerApplied: "5% Cashback", savings: 125 },
    { date: new Date(currentYear, 1, 18).toISOString(), amount: 800, paymentMethodUsed: { id: "pm_paytm_wallet", name: "Paytm Wallet", type: "wallet" }, category: "Bills", offerApplied: "₹10 off", savings: 10 },
    { date: new Date(currentYear, 1, 28).toISOString(), amount: 3500, paymentMethodUsed: { id: "pm_hdfc_regalia_cc", name: "HDFC Regalia Gold CC", type: "credit_card" }, category: "Electronics", offerApplied: "Special Discount", savings: 300 },

    // March
    { date: new Date(currentYear, 2, 8).toISOString(), amount: 4200, paymentMethodUsed: { id: "pm_axis_credit", name: "Axis Bank Credit Card", type: "credit_card" }, category: "Groceries", offerApplied: "7.5% off", savings: 315 },
    { date: new Date(currentYear, 2, 19).toISOString(), amount: 950, paymentMethodUsed: { id: "pm_gpay_upi", name: "UPI", type: "upi", upiId: "user@okhdfcbank" }, category: "Shopping", offerApplied: "None", savings: 0 },
    { date: new Date(currentYear, 2, 27).toISOString(), amount: 18000, paymentMethodUsed: { id: "pm_sbi_click_cc", name: "SBI SimplyCLICK CC", type: "credit_card" }, category: "Travel", offerApplied: "Travel Voucher", savings: 500 },

    // April
    { date: new Date(currentYear, 3, 3).toISOString(), amount: 5500, paymentMethodUsed: { id: "pm_federal_debit", name: "Federal Bank Debit Card", type: "debit_card" }, category: "Electronics", offerApplied: "10% off", savings: 550 },
    { date: new Date(currentYear, 3, 16).toISOString(), amount: 1250, paymentMethodUsed: { id: "pm_icici_amazon_cc", name: "Amazon Pay ICICI Credit Card", type: "credit_card" }, category: "Groceries", offerApplied: "5% Cashback", savings: 62.5 },
    { date: new Date(currentYear, 3, 29).toISOString(), amount: 700, paymentMethodUsed: { id: "pm_paytm_wallet", name: "Paytm Wallet", type: "wallet" }, category: "Bills", offerApplied: "₹10 off", savings: 10 },

    // May
    { date: new Date(currentYear, 4, 7).toISOString(), amount: 22000, paymentMethodUsed: { id: "pm_hdfc_regalia_cc", name: "HDFC Regalia Gold CC", type: "credit_card" }, category: "Travel", offerApplied: "Partner Offer", savings: 1000 },
    { date: new Date(currentYear, 4, 18).toISOString(), amount: 3100, paymentMethodUsed: { id: "pm_axis_credit", name: "Axis Bank Credit Card", type: "credit_card" }, category: "Shopping", offerApplied: "7.5% off", savings: 232.5 },
    { date: new Date(currentYear, 4, 25).toISOString(), amount: 1800, paymentMethodUsed: { id: "pm_gpay_upi", name: "UPI", type: "upi", upiId: "user@okhdfcbank" }, category: "Electronics", offerApplied: "None", savings: 0 },
  ];

  let addedCount = 0;
  try {
    for (const txData of sampleTransactions) {
      const transactionToSave = {
        userId: MOCK_USER_ID,
        date: txData.date, // ISO String
        amount: txData.amount,
        paymentMethodUsed: txData.paymentMethodUsed, // This is Pick<PaymentMethod, "id" | "name" | "type">
        category: txData.category,
        offerApplied: txData.offerApplied,
        savings: txData.savings,
        createdAt: serverTimestamp(), // For ordering
      };
      await addDoc(collection(firestore, "transactions"), transactionToSave);
      addedCount++;
    }
    console.log(`Successfully added ${addedCount} sample transactions to Firestore.`);
    revalidatePath('/dashboard'); // Revalidate dashboard after adding
    return { success: true, message: `Successfully added ${addedCount} sample transactions.`, count: addedCount };
  } catch (error: any) {
    console.error("CRITICAL: Error adding sample transactions to Firestore:", error);
    let clientErrorMessage = "Failed to add sample transactions to database.";
     if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes('permission denied'))) {
        clientErrorMessage = "Database permission denied. Ensure Firestore security rules allow writes to the 'transactions' collection for the MOCK_USER_ID.";
    }
    return { success: false, message: clientErrorMessage, count: addedCount };
  }
}
