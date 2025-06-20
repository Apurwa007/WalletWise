
'use server';

/**
 * @fileOverview A smart payment suggestion AI agent for WalletWise, now using richer offer data.
 *
 * - getSmartPaymentSuggestion - A function that handles the payment suggestion process.
 * - SmartPaymentSuggestionInput - The input type for the getSmartPaymentSuggestion function.
 * - SmartPaymentSuggestionOutput - The return type for the getSmartPaymentSuggestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { mockUserProfile } from '@/lib/mockData'; 
import type { PaymentMethod, Offer } from '@/lib/types'; 

// Define Zod schemas for structured input and output based on the new Offer structure

const OfferPromptSchema = z.object({
  id: z.string(),
  description: z.string().describe("Synthesized human-readable description of the offer, including key terms but EXCLUDING validity period."),
  type: z.enum(["cashback", "miles", "flat_discount", "voucher", "bonus_reward", "other"]),
  value: z.number().describe("Numeric value of the offer (e.g., percentage for cashback, amount for flat discount, multiplier for miles)."),
  valueType: z.enum(["percentage", "amount", "multiplier", "points"]).optional().describe("Type of the numeric value."),
  minSpend: z.number().optional().describe("Minimum spend required for the offer, if any."),
  maxDiscount: z.number().optional().describe("General maximum discount for the offer, if any."),
  maxDiscountCredit: z.number().optional().describe("Specific maximum discount if the payment method is a credit card."),
  maxDiscountDebit: z.number().optional().describe("Specific maximum discount if the payment method is a debit card."),
  maxDiscountEMI: z.number().optional().describe("Specific maximum discount if the transaction is EMI."),
  period: z.string().optional().describe("Validity period of the offer. (This is for AI decision making, not for display in offerDisplay)."),
  categoryAffinityString: z.string().optional().describe("Comma-separated string of applicable categories."),
  applicableOnString: z.string().optional().describe("Comma-separated string of specific conditions like 'EMI only'."),
  specificCardType: z.string().optional().describe("If the offer is tied to a very specific card name like 'Amazon Pay ICICI CC'."),
});


const PaymentMethodPromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["credit_card", "debit_card", "upi", "wallet", "gift_card"]),
  bankName: z.string().optional(),
  usagePercentage: z.number().optional().describe("Credit utilization as a percentage, e.g., 70 for 70%"),
  offers: z.array(OfferPromptSchema).optional(),
  walletBalance: z.number().optional(),
});

const SmartPaymentSuggestionInputSchema = z.object({
  userId: z.string().describe('The ID of the user.'),
  cartTotal: z.number().describe('The total amount of the cart.'),
  category: z.string().optional().describe('The category of the purchase (e.g., Shopping, Travel, Mobiles).'),
});
export type SmartPaymentSuggestionInput = z.infer<typeof SmartPaymentSuggestionInputSchema>;


const RecommendedMethodSchema = z.object({
  paymentMethodId: z.string().describe("The ID of the recommended payment method."),
  name: z.string().describe('The name of the recommended payment method.'),
  offerType: z.string().describe('The type of offer (e.g., cashback, miles, flat_discount). If no specific monetary offer, can be "standard_payment" or the type of a non-monetary benefit.'),
  offerDisplay: z.string().describe("A user-friendly string representing the best offer selected for this method (e.g., '10% Cashback up to \u20B9150'). Do NOT include the validity period in this string. If no specific offer is chosen, use 'Standard Payment' or similar."),
  reason: z.string().describe('The reason for this recommendation, focusing on savings achieved and any constraints met/avoided.'),
});

const SmartPaymentSuggestionOutputSchema = z.object({
  recommended: RecommendedMethodSchema,
});
export type SmartPaymentSuggestionOutput = z.infer<typeof SmartPaymentSuggestionOutputSchema>;


export async function getSmartPaymentSuggestion(input: SmartPaymentSuggestionInput): Promise<SmartPaymentSuggestionOutput> {
  const userProfile = mockUserProfile.id === input.userId ? mockUserProfile : null;

  if (!userProfile) {
    throw new Error(`User profile not found for userId: ${input.userId}`);
  }
  
  const promptContext = {
    userGoal: userProfile.goal,
    paymentMethods: userProfile.savedPaymentMethods.map(pm => ({
      id: pm.id,
      name: pm.name,
      type: pm.type,
      bankName: pm.bankName,
      usagePercentage: pm.type === 'credit_card' && pm.usage !== undefined ? pm.usage * 100 : undefined,
      offers: pm.offers?.map(offer => ({
        id: offer.id,
        description: offer.description, 
        type: offer.type,
        value: offer.value,
        valueType: offer.valueType,
        minSpend: offer.conditions?.minSpend,
        maxDiscount: offer.conditions?.maxDiscount,
        maxDiscountCredit: offer.conditions?.maxDiscountCredit,
        maxDiscountDebit: offer.conditions?.maxDiscountDebit,
        maxDiscountEMI: offer.conditions?.maxDiscountEMI,
        period: offer.conditions?.period, 
        categoryAffinityString: offer.categoryAffinity?.join(", "),
        applicableOnString: offer.conditions?.applicableOn?.join(", "),
        specificCardType: offer.specificCardType,
      })),
      walletBalance: pm.type === 'wallet' || pm.type === 'gift_card' ? pm.walletBalance : undefined,
    })),
    cartTotal: input.cartTotal,
    purchaseCategory: input.category,
  };

  const smartPaymentSuggestionPrompt = ai.definePrompt({
    name: 'walletWiseSmartPaymentSuggestionPrompt',
    model: 'googleai/gemini-1.5-flash-latest',
    input: { schema: z.object({
      userGoal: z.string().nullable(),
      paymentMethods: z.array(PaymentMethodPromptSchema),
      cartTotal: z.number(),
      purchaseCategory: z.string().optional(),
    }) },
    output: { schema: SmartPaymentSuggestionOutputSchema },
    prompt: `You are an AI assistant for WalletWise helping users choose the best payment method for their purchase.
User's financial goal: {{#if userGoal}}{{userGoal}}{{else}}None specified{{/if}} (This goal is strictly secondary to maximizing immediate savings.)
Cart Total: \u20B9{{cartTotal}}
Purchase Category: {{#if purchaseCategory}}{{purchaseCategory}}{{else}}General{{/if}}

Available Payment Methods:
{{#each paymentMethods}}
- ID: {{id}}
  Name: {{name}} ({{type}}{{#if bankName}}, {{bankName}}{{/if}})
  {{#if usagePercentage}}Credit Usage: {{usagePercentage}}%{{/if}}
  {{#if walletBalance}}Wallet Balance: \u20B9{{walletBalance}}{{/if}}
  Offers:
  {{#each offers}}
  - Offer ID: {{id}}
    Description: "{{description}}" (This is the concise offer summary, validity period is excluded here but available in 'period' field)
    Type: {{type}}
    Value: {{value}}{{#if valueType}} (as {{valueType}}){{/if}}
    {{#if minSpend}}Min Spend: \u20B9{{minSpend}}{{/if}}
    {{#if maxDiscount}}General Max Discount: \u20B9{{maxDiscount}}{{/if}}
    {{#if maxDiscountCredit}}Max Discount (Credit Card): \u20B9{{maxDiscountCredit}}{{/if}}
    {{#if maxDiscountDebit}}Max Discount (Debit Card): \u20B9{{maxDiscountDebit}}{{/if}}
    {{#if maxDiscountEMI}}Max Discount (EMI): \u20B9{{maxDiscountEMI}}{{/if}}
    {{#if period}}Period: {{period}} (Use for applicability checks, but DO NOT include in recommended.offerDisplay){{/if}}
    {{#if categoryAffinityString}}Applicable Categories: {{categoryAffinityString}}{{/if}}
    {{#if applicableOnString}}Other Conditions: {{applicableOnString}}{{/if}}
    {{#if specificCardType}}Specific to card: {{specificCardType}}{{/if}}
  {{else}}
  - No specific offers for this payment method.
  {{/each}}
{{/each}}

Recommendation Rules:
1.  **Initial Offer Filtering by Category**:
    a.  For each offer associated with a payment method, first check its \`categoryAffinityString\` against the \`purchaseCategory\`.
    b.  An offer passes this initial category filter if:
        i.  The \`categoryAffinityString\` is empty or undefined (i.e., it's a general offer).
        ii. The \`categoryAffinityString\` is exactly "All Categories".
        iii. The \`purchaseCategory\` is specified, and the \`categoryAffinityString\` directly contains the \`purchaseCategory\` (case-insensitive comparison should be assumed for robust matching).
    c.  An offer that DOES NOT pass this initial category filter (as defined in 1b) is considered to provide **0 (zero) monetary savings for THIS transaction** and should NOT be considered for monetary value calculation in Rule 2, UNLESS the condition in Rule 1d (Fallback Scan) is met. Its direct monetary saving for this transaction is zero.
    d.  **Fallback Scan**: If, after applying Rules 1a-c to ALL offers on ALL payment methods, NO offer provides ANY positive monetary savings (i.e., all calculated savings based on category-filtered offers are zero or negative), THEN and ONLY THEN, you may re-evaluate all offers on all payment methods, this time IGNORING their \`categoryAffinityString\` but still applying all other conditions from Rule 2 onwards.

2.  **Detailed Offer Applicability & Single Best Monetary Offer per Method**:
    For each payment method:
    a.  **Condition Check**: For each of its offers that is being considered (either it passed Rule 1 category filtering, or it's part of a Fallback Scan under Rule 1d), evaluate further conditions. An offer is only *fully applicable* for savings calculation if ALL of the following are true:
        i.  Its 'minSpend' (if any) is less than or equal to 'cartTotal'. If this condition is not met, the offer provides **0 (zero) monetary savings for this transaction.**
        ii. If the offer has 'specificCardType', the payment method name must match it. If not, **0 savings.**
        iii. The current date is within the offer's 'period' (Assume current date is within period for this simulation if not explicitly invalid). If not, **0 savings.**
        iv. 'applicableOnString' conditions like "EMI" are NOT met for this basic recommendation unless the offer clearly supports non-EMI use with distinct caps. Prioritize non-EMI offers and their caps. If an offer is EMI-only (or its non-EMI applicability isn't clear from its caps), treat its direct monetary saving as **0 for non-EMI transactions.** **DO NOT use \`maxDiscountEMI\` as a cap for direct, non-EMI savings calculations.**
    b.  **Calculate Monetary Value**: For each offer deemed *fully applicable* from Rule 2a (and that is NOT primarily an EMI offer without clear non-EMI caps for a direct transaction):
        - Cashback: \`(value/100 * cartTotal)\`. Then cap this amount. If the payment method \`type\` is 'credit_card' and 'maxDiscountCredit' is available for the offer, use that as the cap. Else if \`type\` is 'debit_card' and 'maxDiscountDebit' is available, use that. Otherwise, use 'maxDiscount' if available (and it's not an EMI-only general cap). If no relevant non-EMI cap, calculated savings is uncapped.
        - Flat Discount: \`value\`. (This is also subject to \`minSpend\` if specified, which was already checked in 2.a.i).
        - Other types (miles, voucher, bonus_reward): Monetary value is **0 for this primary sorting.**
    c.  **Select Single Best Monetary Offer**: From the *fully applicable* offers for a payment method (as determined by Rule 2a and 2b), select the one that provides the highest calculated monetary value (as calculated in 2b). If multiple offers give the same highest monetary value, prefer cashback over flat_discount. If no fully applicable offers provide positive monetary value, this payment method is considered to provide **0 savings for this transaction.**

3.  **Overall Best Payment Method - CRITERION: ABSOLUTELY MAXIMIZE MONETARY SAVINGS (excluding 'Amazon Pay')**:
    *   **Exclusion Rule**: You MUST NOT recommend any payment method whose \`name\` is 'Amazon Pay', regardless of its potential savings.
    *   Your single most important task is to identify the payment method *from the remaining eligible methods* (i.e., not named 'Amazon Pay') that, through one of its *fully applicable* offers (determined by Rule 2), yields the **largest possible direct monetary saving** for the user on THIS specific transaction.
    *   Compare the best monetary saving calculated for each *eligible* payment method (from Rule 2c, excluding any method named 'Amazon Pay'). The method providing the HIGHEST saving is your primary recommendation. This decision is based **solely** on the calculated monetary savings from Rule 2c. Factors like credit card utilization or wallet balance must **not** influence this selection of the payment method ID.
    *   **Tie-Breaking for Equal Highest Savings (among eligible methods)**: If multiple *eligible* methods offer the exact same highest monetary saving, then (and only then) use the following preference: Credit Cards > Debit Cards > UPI > Wallets. If still tied, select the first such method you processed based on the input order.
    *   The user's stated financial goal is a very minor, secondary factor and MUST NOT lead you to select a payment method that offers less monetary savings than another available *eligible* option.

4.  **Constraint Handling (This rule *only* affects the 'reason' field; it does *not* change the payment method selected by Rule 3)**:
    a.  **Credit Card Utilization**: If the payment method selected by Rule 3 (highest savings from eligible methods) is a credit card and its 'usagePercentage' is > 80%, this method should STILL BE RECOMMENDED if it offers the absolute highest savings among eligible methods. However, the 'reason' for the recommendation MUST prominently mention the high utilization (e.g., "Offers highest savings of \u20B9X, but note: credit utilization is high at {{usagePercentage}}%."). Do NOT discard this method for a lower-saving option due to high utilization alone.
    b.  **Wallet/Gift Card Balance**: If the payment method selected by Rule 3 (highest savings from eligible methods) is a 'wallet' or 'gift_card' and its \`walletBalance < cartTotal\`, this method should STILL BE RECOMMENDED if it offers the absolute highest savings among eligible methods. However, the 'reason' for the recommendation MUST prominently state that the balance is insufficient for this transaction (e.g., "Offers highest savings of \u20B9X, but note: wallet balance of \u20B9{{walletBalance}} is less than cart total of \u20B9{{cartTotal}}."). Do NOT discard this method for a lower-saving option due to insufficient balance alone. If the wallet balance IS sufficient, no special mention is needed unless it's part of another benefit.

5.  **Output Formatting**:
    *   \`recommended.paymentMethodId\`: ID of the chosen payment method (from Rule 3, must not be 'Amazon Pay').
    *   \`recommended.name\`: Name of the chosen payment method.
    *   \`recommended.offerType\`: The raw type of the chosen offer (e.g., "cashback", "flat_discount"). If no monetary offer was chosen (e.g., plain UPI), use the offer's type or "standard_payment".
    *   \`recommended.offerDisplay\`: A user-friendly string representing the best offer selected for this method (e.g., '10% Cashback up to \u20B9150'). Do NOT include the validity period in this string. If no specific offer is chosen, use 'Standard Payment' or similar.
    *   \`recommended.reason\`: Explain *why* this method is best, primarily focusing on the savings achieved (e.g., "Offers the highest savings of \u20B9X for '{{purchaseCategory}}' with its '10% Cashback (up to \u20B9Y)' offer."). Incorporate any relevant constraint information as per Rule 4. If no savings, explain why (e.g., "Standard payment, no specific discounts apply for this purchase."). If all available methods are 'Amazon Pay', or no other methods are suitable, state that "No other payment methods offer significant savings for this transaction."

Based on these rules, focusing exclusively on maximizing monetary savings from eligible methods as per Rule 3, suggest the 'recommended' payment method.
If no eligible offers apply or no eligible methods are suitable, try to recommend a basic suitable eligible method (e.g., UPI if available and not 'Amazon Pay', or a card with low utilization if no savings options from eligible methods) and state why it's a reasonable choice.
`,
  });
  
  const { output } = await smartPaymentSuggestionPrompt(promptContext);
  if (!output) {
    throw new Error("AI failed to generate a suggestion.");
  }
  return output;
}

const smartPaymentSuggestionFlow = ai.defineFlow(
  {
    name: 'smartPaymentSuggestionFlow',
    inputSchema: SmartPaymentSuggestionInputSchema,
    outputSchema: SmartPaymentSuggestionOutputSchema,
  },
  async (input) => {
    return getSmartPaymentSuggestion(input);
  }
);

