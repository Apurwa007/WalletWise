
// @ts-nocheck
"use client";

import { useState, useEffect, useMemo, useCallback, useActionState, startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle, Info, Loader2, Sparkles, ShoppingBag, CreditCard, WalletCards, IndianRupee, Gift, Filter, Lightbulb, RefreshCw } from 'lucide-react';
import { MOCK_USER_ID, mockUserProfile as initialUserProfile, getPaymentMethodDisplayDetails, transactionCategories } from '@/lib/mockData';
import type { PaymentMethod, SmartRecommendation, UserProfile, Offer } from '@/lib/types';
import { getRecommendationAction, logTransactionAction, getMockUserProfileServer } from '@/lib/actions';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { calculatePotentialSavingsForMethod } from '@/lib/utils';
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';

const initialRecommendationState: SmartRecommendation | { error: string } | null = null;

export default function CheckoutPage() {
  const [cartTotal, setCartTotal] = useState<number>(199.99);
  const [purchaseCategory, setPurchaseCategory] = useState<string>("Shopping");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(initialUserProfile);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [recommendationState, formAction, isRecommendationPending] = useActionState(getRecommendationAction, initialRecommendationState);

  const recommendation = useMemo(() => {
    if (recommendationState && 'recommended' in recommendationState) {
      return recommendationState as SmartRecommendation;
    }
    return null;
  }, [recommendationState]);

  const recommendationError = useMemo(() => {
    if (recommendationState && 'error' in recommendationState) {
      return (recommendationState as { error: string }).error;
    }
    return null;
  }, [recommendationState]);

  useEffect(() => {
    async function loadProfileAndFetchInitialRecommendation() {
      const profile = await getMockUserProfileServer();
      setUserProfile(profile);
      if (profile.id && cartTotal > 0) {
        const formData = new FormData();
        formData.append('userId', profile.id);
        formData.append('cartTotal', cartTotal.toString());
        formData.append('category', purchaseCategory);
        startTransition(() => {
          formAction(formData);
        });
      }
    }
    loadProfileAndFetchInitialRecommendation();
  }, [formAction]); // formAction's identity is stable

 useEffect(() => {
    if (cartTotal > 0 && userProfile.id) {
      const formData = new FormData();
      formData.append('userId', userProfile.id);
      formData.append('cartTotal', cartTotal.toString());
      formData.append('category', purchaseCategory);
      startTransition(() => {
        formAction(formData);
      });
    }
  }, [cartTotal, purchaseCategory, userProfile.id, formAction]);


  useEffect(() => {
    if (recommendation?.recommended?.paymentMethodId && !selectedPaymentMethodId) {
      setSelectedPaymentMethodId(recommendation.recommended.paymentMethodId);
    }
  }, [recommendation, selectedPaymentMethodId]);

  useEffect(() => {
    if (recommendationError) {
      toast({
        title: "Recommendation Error",
        description: recommendationError,
        variant: "destructive",
      });
    }
  }, [recommendationError, toast]);

  const handlePayment = async () => {
    if (!selectedPaymentMethodId) {
      toast({ title: "Payment Error", description: "Please select a payment method.", variant: "destructive" });
      return;
    }
    setIsProcessingPayment(true);

    const result = await logTransactionAction(userProfile.id, cartTotal, selectedPaymentMethodId, purchaseCategory, recommendation);

    if (result.success && result.newTransactionId) {
      toast({
        title: "Payment Successful!",
        description: result.message,
        className: "bg-green-100 dark:bg-green-800 border-green-500",
        duration: 5000,
        action: <CheckCircle className="text-green-600 dark:text-green-300" />,
      });
      setCartTotal(Math.random() * 200 + 50);
      setSelectedPaymentMethodId(null);
      router.refresh();
    } else {
      toast({
        title: "Payment Failed",
        description: result.message || "An unknown error occurred. Transaction not saved.",
        variant: "destructive",
      });
      if (result.error) {
          console.error("Server action error details (logTransactionAction):", result.error);
      }
    }
    setIsProcessingPayment(false);
  };

  const getIconForMethod = (methodType: PaymentMethod['type']) => {
    return getPaymentMethodDisplayDetails(methodType).icon;
  };

  const sortedPaymentMethods = useMemo(() => {
    if (!userProfile?.savedPaymentMethods) return [];

    const aiRecommendedMethodId = recommendation?.recommended?.paymentMethodId;
    const allMethodsMutable = [...userProfile.savedPaymentMethods]; // Create a mutable copy

    let recommendedMethodForDisplay: PaymentMethod | undefined = undefined;
    if (aiRecommendedMethodId) {
      const index = allMethodsMutable.findIndex(method => method.id === aiRecommendedMethodId);
      // Ensure the AI recommended method is not "Amazon Pay" as per AI prompt rules
      if (index > -1 && allMethodsMutable[index].name !== "Amazon Pay") { 
        recommendedMethodForDisplay = allMethodsMutable.splice(index, 1)[0];
      }
    }

    let amazonPayMethod: PaymentMethod | undefined = undefined;
    const amazonPayIndex = allMethodsMutable.findIndex(method => method.name === "Amazon Pay");
    if (amazonPayIndex > -1) {
      amazonPayMethod = allMethodsMutable.splice(amazonPayIndex, 1)[0];
    }

    // Now 'allMethodsMutable' contains only non-recommended, non-Amazon Pay methods
    const otherSortedMethods = allMethodsMutable.sort((methodA, methodB) => {
      const savingsA = calculatePotentialSavingsForMethod(cartTotal, purchaseCategory, methodA);
      const savingsB = calculatePotentialSavingsForMethod(cartTotal, purchaseCategory, methodB);
      const amountA = savingsA?.amount || 0;
      const amountB = savingsB?.amount || 0;

      if (amountB !== amountA) {
        return amountB - amountA; // Primary sort: descending savings
      }
      return methodA.name.localeCompare(methodB.name); // Secondary sort by name if savings are equal
    });

    const finalSortedList: PaymentMethod[] = [];
    if (recommendedMethodForDisplay) {
      finalSortedList.push(recommendedMethodForDisplay);
    }
    finalSortedList.push(...otherSortedMethods);
    if (amazonPayMethod) {
      finalSortedList.push(amazonPayMethod);
    }

    return finalSortedList;
  }, [userProfile?.savedPaymentMethods, cartTotal, purchaseCategory, recommendation]);


  const currentlySelectedMethodName = useMemo(() => {
    if (!selectedPaymentMethodId || !userProfile.savedPaymentMethods) return null;
    return userProfile.savedPaymentMethods.find(m => m.id === selectedPaymentMethodId)?.name;
  }, [selectedPaymentMethodId, userProfile.savedPaymentMethods]);

  const deliveryCharge = useMemo(() => {
    return cartTotal < 499 && cartTotal > 0 ? 40 : 0;
  }, [cartTotal]);

  const selectedMethodDetails = useMemo(() => {
    if (!selectedPaymentMethodId || !userProfile.savedPaymentMethods) return null;
    return userProfile.savedPaymentMethods.find(m => m.id === selectedPaymentMethodId);
  }, [selectedPaymentMethodId, userProfile.savedPaymentMethods]);

  const instantBankDiscountDetails = useMemo(() => {
    if (!selectedMethodDetails || cartTotal <= 0) return null;
    const savings = calculatePotentialSavingsForMethod(cartTotal, purchaseCategory, selectedMethodDetails);
    if (savings && (savings.offer.type === 'cashback' || savings.offer.type === 'flat_discount')) {
      if (savings.amount > 0) return savings;
    }
    return null;
  }, [selectedMethodDetails, cartTotal, purchaseCategory]);

  const instantBankDiscount = instantBankDiscountDetails ? instantBankDiscountDetails.amount : 0;

  const finalOrderTotal = useMemo(() => {
    const total = cartTotal + deliveryCharge - instantBankDiscount;
    return total > 0 ? total : 0;
  }, [cartTotal, deliveryCharge, instantBankDiscount]);

  const displayCartTotal = cartTotal > 0 ? cartTotal.toFixed(2) : '0.00';


  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
      <div className="md:col-span-2">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <ShoppingBag className="mr-3 h-7 w-7 text-primary" /> Secure Checkout
            </CardTitle>
            <CardDescription>Review your order and choose your payment method.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cartTotal" className="text-sm font-medium">Items Price (₹)</Label>
                <Input
                  id="cartTotal"
                  type="number"
                  value={cartTotal}
                  onChange={(e) => setCartTotal(Math.max(0, Number(e.target.value)))}
                  className="text-2xl font-semibold mt-1"
                  placeholder="e.g. 199.99"
                  suppressHydrationWarning={true}
                />
              </div>
              <div>
                <Label htmlFor="purchaseCategory" className="text-sm font-medium">Category</Label>
                 <Select value={purchaseCategory} onValueChange={setPurchaseCategory}>
                  <SelectTrigger id="purchaseCategory" className="mt-1 text-lg" suppressHydrationWarning={true}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {transactionCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category === "All" ? "General" : category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Select Payment Method</h3>
              </div>

              {isRecommendationPending && (
                <div className="flex items-center text-sm text-muted-foreground my-4 p-3 border border-dashed rounded-md animate-pulse">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching smart recommendations...
                </div>
              )}
              {recommendationError && !isRecommendationPending && (
                 <div className="flex items-center text-sm text-red-600 dark:text-red-400 my-4 p-3 border border-dashed border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/30 rounded-md">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Could not fetch recommendations: {recommendationError}
                </div>
              )}

              <RadioGroup
                value={selectedPaymentMethodId || ""}
                onValueChange={setSelectedPaymentMethodId}
                className="grid gap-2"
              >
                {sortedPaymentMethods.map((method) => {
                  const isRecommended = recommendation?.recommended?.paymentMethodId === method.id;
                  const potentialSavingDetails = calculatePotentialSavingsForMethod(cartTotal, purchaseCategory, method);

                  let offerText = "";
                  let reasonText = "";

                  if (isRecommended) {
                    offerText = recommendation!.recommended.offerDisplay;
                    reasonText = recommendation!.recommended.reason;
                  }

                  const IconComponent = getIconForMethod(method.type);

                  return (
                    <Label
                      key={method.id}
                      htmlFor={method.id}
                      className={cn(
                        "flex items-start p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md",
                        "border-border",
                        isRecommended && "bg-green-50 dark:bg-green-900/30 border-green-500 dark:border-green-600",
                        selectedPaymentMethodId === method.id && (
                          isRecommended
                            ? "ring-1 ring-green-600/70 dark:ring-green-500/70 shadow-md"
                            : "border-primary ring-1 ring-primary/70 shadow-md"
                        )
                      )}
                    >
                      <RadioGroupItem value={method.id} id={method.id} className="mr-4 mt-1 flex-shrink-0" />
                      <IconComponent className={`mr-3 h-6 w-6 mt-1 flex-shrink-0 ${isRecommended ? 'text-green-700 dark:text-green-400' : 'text-primary'}`} />
                      <div className="flex-grow min-w-0">
                        <span className="font-medium text-foreground">
                          {method.name}
                          {method.bankName && <span className="text-xs text-muted-foreground"> ({method.bankName})</span>}
                        </span>

                        {potentialSavingDetails && (
                            <span className={`block text-xs font-semibold mt-0.5 ${isRecommended ? 'text-green-600 dark:text-green-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                ({potentialSavingDetails.description})
                            </span>
                        )}

                        <div className="text-xs text-muted-foreground mt-0.5">
                          {method.last4Digits && `···· ${method.last4Digits}`}
                          {method.upiId && method.upiId}
                          {(method.type === 'wallet' || method.type === 'gift_card') && method.walletBalance !== undefined && method.name !== 'Paytm Wallet' && (
                            <span> Balance: ₹{method.walletBalance.toFixed(2)}</span>
                          )}
                        </div>

                        {isRecommended && offerText && (
                            <span className={`block text-xs font-bold mt-1 ${isRecommended ? 'text-green-700 dark:text-green-500' : 'text-amber-600 dark:text-amber-400'}`}>
                                <Sparkles className="inline-block mr-1 h-3 w-3" />
                                {offerText}
                            </span>
                        )}
                         {!isRecommended && method.offers && method.offers.length > 0 && (
                            <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <p className="text-xs text-muted-foreground mt-1 cursor-help min-w-0">
                                            <Info className="inline-block mr-1 h-3 w-3 text-blue-500" />
                                            {method.offers[0].description} {method.offers.length > 1 ? `(+${method.offers.length-1} more)` : ''}
                                        </p>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs bg-card text-card-foreground border-border p-3 shadow-xl rounded-md">
                                        <p className="text-sm font-semibold mb-1">Available Offers:</p>
                                        <ul className="list-disc pl-4 text-xs space-y-1">
                                            {method.offers.slice(0,3).map(o => <li key={o.id}>{o.description}</li>)}
                                            {method.offers.length > 3 && <li>And more...</li>}
                                        </ul>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                      </div>
                      {isRecommended && reasonText && (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="ml-2 h-5 w-5 text-green-600 dark:text-green-400 cursor-help flex-shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-card text-card-foreground border-green-500 p-3 shadow-xl rounded-md">
                              <p className="text-sm font-semibold mb-1">Why recommended:</p>
                              <p className="text-xs">{reasonText}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>
          </CardContent>
          <CardFooter>
            <Button size="lg" className="w-full text-base py-6 rounded-lg" onClick={handlePayment} disabled={!selectedPaymentMethodId || isProcessingPayment || isRecommendationPending} suppressHydrationWarning={true}>
              {isProcessingPayment || isRecommendationPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
              Pay ₹{finalOrderTotal > 0 ? finalOrderTotal.toFixed(2) : '0.00'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="md:col-span-1 space-y-6">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items Price</span>
              <span>₹{displayCartTotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Charge</span>
              {deliveryCharge > 0 ? (
                <span>₹{deliveryCharge.toFixed(2)}</span>
              ) : (
                <span className="text-green-600 dark:text-green-400 font-medium">FREE</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Instant Bank Discount</span>
              {instantBankDiscount > 0 ? (
                <span className="text-green-600 dark:text-green-400 font-medium">- ₹{instantBankDiscount.toFixed(2)}</span>
              ) : (
                <span>₹0.00</span>
              )}
            </div>
            <hr className="my-2 border-border" />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>₹{finalOrderTotal > 0 ? finalOrderTotal.toFixed(2) : '0.00'}</span>
            </div>
          </CardContent>
        </Card>

        {recommendation && selectedPaymentMethodId && recommendation.recommended.paymentMethodId !== selectedPaymentMethodId && currentlySelectedMethodName && (
          <Card className="bg-sky-50 dark:bg-sky-900/30 border-sky-500 dark:border-sky-600 shadow-md rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center text-sky-700 dark:text-sky-300">
                <Lightbulb className="mr-2 h-5 w-5"/> Consider Our Top Pick!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
               <p className="text-sm text-sky-800 dark:text-sky-200">
                You've selected <strong>{currentlySelectedMethodName}</strong>.
              </p>
              <p className="text-sm text-sky-800 dark:text-sky-200 mt-1">
                Our AI suggests <strong>{recommendation.recommended.name}</strong> to get <strong className="font-semibold">{recommendation.recommended.offerDisplay}</strong>.
              </p>
              <p className="text-xs text-sky-600 dark:text-sky-400">
                <span className="font-medium not-italic">Reason:</span> <i className="italic">{recommendation.recommended.reason}</i>
              </p>
              <Button
                variant="link"
                size="sm"
                className="text-sky-700 dark:text-sky-300 font-semibold hover:text-sky-600 dark:hover:text-sky-200 px-0"
                onClick={() => setSelectedPaymentMethodId(recommendation.recommended.paymentMethodId)}
                suppressHydrationWarning={true}>
               Switch to {recommendation.recommended.name}
             </Button>
            </CardContent>
          </Card>
        )}

        <div className="p-4 border border-dashed rounded-lg text-center bg-card">
            <Image src="https://placehold.co/300x200.png" alt="Featured Product" width={300} height={200} className="rounded-md mx-auto mb-3 shadow-sm" data-ai-hint="ecommerce product" />
            <p className="text-sm text-muted-foreground">Your items are waiting for you!</p>
        </div>
      </div>
    </div>
  );
}
