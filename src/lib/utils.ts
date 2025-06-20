
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { PaymentMethod, Offer } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculatePotentialSavingsForMethod(
  cartTotal: number,
  purchaseCategory: string,
  method: PaymentMethod
): { amount: number; description: string; offer: Offer } | null {
  if (!method.offers || method.offers.length === 0 || cartTotal <= 0) {
    return null;
  }

  let bestSaving = -1; 
  let bestOfferForSaving: Offer | null = null;

  for (const offer of method.offers) {
    let categoryIsApplicable = false;
    if (!offer.categoryAffinity || offer.categoryAffinity.length === 0) {
      categoryIsApplicable = true; 
    } else if (purchaseCategory) {
      const lowerPurchaseCategory = purchaseCategory.toLowerCase();
      const affinityCategoriesLower = offer.categoryAffinity.map(cat => cat.toLowerCase());
      if (affinityCategoriesLower.includes(lowerPurchaseCategory) || affinityCategoriesLower.includes("all categories")) {
        categoryIsApplicable = true;
      }
    }
    if (!categoryIsApplicable) {
      continue; 
    }

    if (offer.conditions?.minSpend && cartTotal < offer.conditions.minSpend) {
      continue; 
    }
    
    let isPrimarilyEMIContextOffer = false;
    if (offer.conditions?.applicableOn?.includes("EMI")) {
        const hasSpecificNonEMICap = offer.conditions.maxDiscountCredit !== undefined || offer.conditions.maxDiscountDebit !== undefined;
        if (!hasSpecificNonEMICap) {
            // If it's an EMI offer and lacks specific credit/debit caps,
            // we treat its monetary part as not directly calculable for this non-EMI UI helper.
            isPrimarilyEMIContextOffer = true;
        }
    }
    
    let currentOfferSaving = 0;

    if (!isPrimarilyEMIContextOffer) { // Only calculate monetary savings if not primarily an EMI-capped offer for this UI context
      if (offer.type === "cashback" && offer.valueType === "percentage" && offer.value > 0) {
        currentOfferSaving = (cartTotal * offer.value) / 100;
        
        let applicableMaxDiscount: number | undefined = undefined;

        if (method.type === "credit_card" && offer.conditions?.maxDiscountCredit !== undefined) {
          applicableMaxDiscount = offer.conditions.maxDiscountCredit;
        } else if (method.type === "debit_card" && offer.conditions?.maxDiscountDebit !== undefined) {
          applicableMaxDiscount = offer.conditions.maxDiscountDebit;
        } else if (offer.conditions?.maxDiscount !== undefined) {
          // Use general maxDiscount only if specific credit/debit caps are not present AND it's not an EMI-only general cap
           if (!(offer.conditions?.applicableOn?.includes("EMI") && offer.conditions?.maxDiscountEMI === offer.conditions?.maxDiscount && !offer.conditions?.maxDiscountCredit && !offer.conditions?.maxDiscountDebit)) {
             applicableMaxDiscount = offer.conditions.maxDiscount;
           }
        }

        if (applicableMaxDiscount !== undefined && currentOfferSaving > applicableMaxDiscount) {
          currentOfferSaving = applicableMaxDiscount;
        }

      } else if (offer.type === "flat_discount" && offer.valueType === "amount" && offer.value > 0) {
        currentOfferSaving = offer.value;
      }
      // Miles, bonus_reward, voucher still result in currentOfferSaving = 0 for monetary comparison in this branch
    }
    // If isPrimarilyEMIContextOffer is true, currentOfferSaving remains 0 for monetary types.
    
    if (currentOfferSaving > bestSaving) {
      bestSaving = currentOfferSaving;
      bestOfferForSaving = {...offer, _isPrimarilyEMIContextOffer: isPrimarilyEMIContextOffer}; 
    } else if (currentOfferSaving === 0 && bestSaving < 0 && (offer.type === "miles" || offer.type === "bonus_reward" || offer.type === "voucher" || isPrimarilyEMIContextOffer)) {
      // Prioritize non-monetary benefits or EMI-filtered monetary offers if no direct monetary savings found yet
      bestSaving = 0; 
      bestOfferForSaving = {...offer, _isPrimarilyEMIContextOffer: isPrimarilyEMIContextOffer};
    }
  }

  if (bestSaving >= 0 && bestOfferForSaving) {
    let displaySavingText: string;
    
    if (bestSaving > 0) { // Positive monetary saving calculated and not filtered out
        displaySavingText = `Save ₹${bestSaving.toFixed(2)}`;
    } else if (bestOfferForSaving) { // Non-monetary, or monetary offer filtered due to EMI context
        if (bestOfferForSaving.type === "miles" && bestOfferForSaving.value > 0) {
            displaySavingText = `${bestOfferForSaving.value}x Miles`;
        } else if (bestOfferForSaving.type === "bonus_reward" && bestOfferForSaving.value > 0 && bestOfferForSaving.valueType === "points") {
            displaySavingText = `${bestOfferForSaving.value} Points`;
        } else if (bestOfferForSaving.description) {
            // If it was a monetary type (cashback/flat_discount) but its monetary value was filtered (e.g. EMI context)
            // or it's a voucher etc., show a generic benefit.
            if ((bestOfferForSaving.type === "cashback" || bestOfferForSaving.type === "flat_discount") && (bestOfferForSaving as any)._isPrimarilyEMIContextOffer) {
                displaySavingText = "Benefit Available";
            } else {
                const descWords = bestOfferForSaving.description.split(' ');
                 if (descWords.length > 5 && !(bestOfferForSaving.type === "miles" || bestOfferForSaving.type === "bonus_reward")) {
                     displaySavingText = "Benefit Available";
                 } else {
                      displaySavingText = bestOfferForSaving.description.split(',')[0]; 
                 }
            }
        } else {
            displaySavingText = "Benefit Available";
        }
    } else {
         displaySavingText = "Benefit Available"; // Fallback, should ideally not be hit if bestOfferForSaving is present
    }
    
    return { 
      amount: bestSaving, 
      description: displaySavingText, 
      offer: bestOfferForSaving 
    };
  }

  return null;
}
