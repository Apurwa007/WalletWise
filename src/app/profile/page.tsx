
// @ts-nocheck
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { User, Target, CreditCard, Trash2, PlusCircle, Save, IndianRupee, WalletCards as WalletIcon, Gift, Loader2 } from 'lucide-react'; // Updated icons
import { MOCK_USER_ID, financialGoals as defaultFinancialGoals, mockUserProfile as initialProfile, getPaymentMethodDisplayDetails } from '@/lib/mockData';
import type { FinancialGoalValue, PaymentMethod, UserProfile } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { updateUserGoalAction, addPaymentMethodAction, removePaymentMethodAction, getMockUserProfileServer } from '@/lib/actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const paymentMethodFormSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }).max(50, { message: "Name too long."}),
  type: z.enum(["credit_card", "debit_card", "upi", "wallet", "gift_card"], { required_error: "Payment type is required." }),
  last4Digits: z.string().optional().refine(val => !val || /^\d{4}$/.test(val), { message: "Must be 4 digits if provided." }),
  upiId: z.string().optional().refine(val => !val || /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(val), { message: "Invalid UPI ID format (e.g. yourname@bank)."}),
  walletBalance: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0, "Balance cannot be negative.").optional()
  ),
}).superRefine((data, ctx) => {
  if ((data.type === "credit_card" || data.type === "debit_card") && !data.last4Digits) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Last 4 digits are required for cards.",
      path: ["last4Digits"],
    });
  }
  if (data.type === "upi" && !data.upiId) {
     ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "UPI ID is required for UPI type.",
      path: ["upiId"],
    });
  }
});

type PaymentMethodFormData = z.infer<typeof paymentMethodFormSchema>;

const paymentMethodTypes: {value: PaymentMethod['type'], label: string, icon: React.ElementType}[] = [
    { value: "credit_card", label: "Credit Card", icon: CreditCard },
    { value: "debit_card", label: "Debit Card", icon: CreditCard },
    { value: "upi", label: "UPI", icon: IndianRupee },
    { value: "wallet", label: "Wallet", icon: WalletIcon },
    { value: "gift_card", label: "Gift Card", icon: Gift },
];

const ADD_PAYMENT_DIALOG_DESCRIPTION_ID = "add-payment-method-dialog-description";

export default function ProfilePage() {
  const [userProfile, setUserProfile] = useState<UserProfile>(initialProfile);
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const { toast } = useToast();
  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<PaymentMethodFormData>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues: { type: "credit_card", name: "", last4Digits: "", upiId: "", walletBalance: undefined }
  });
  const selectedPaymentType = watch("type");

  useEffect(() => {
    async function fetchData() {
      setLoadingProfile(true);
      const profileData = await getMockUserProfileServer();
      setUserProfile(profileData);
      setLoadingProfile(false);
    }
    fetchData();
  }, []);

  const handleGoalChange = async (goalValue: string) => {
    if (!goalValue) return;
    const newGoal = goalValue as FinancialGoalValue;
    setIsSubmitting(true);
    const result = await updateUserGoalAction(MOCK_USER_ID, newGoal);
    setIsSubmitting(false);
    if (result.success && result.updatedProfile) {
      setUserProfile(result.updatedProfile);
      toast({ title: "Goal Updated!", description: result.message, className: "bg-green-100 dark:bg-green-800 border-green-500" });
    } else {
      toast({ title: "Error Updating Goal", description: result.message, variant: "destructive" });
    }
  };

  const onAddPaymentMethodSubmit: SubmitHandler<PaymentMethodFormData> = async (data) => {
    setIsSubmitting(true);
    const paymentMethodData: Omit<PaymentMethod, 'id' | 'icon' | 'offers' | 'usage'> = {
        name: data.name,
        type: data.type,
        bankName: formData.bankName,
        last4Digits: data.type === "credit_card" || data.type === "debit_card" ? data.last4Digits : undefined,
        upiId: data.type === "upi" ? data.upiId : undefined,
        walletBalance: (data.type === "wallet" || data.type === "gift_card") && data.walletBalance !== undefined ? data.walletBalance : undefined,
    };
    const result = await addPaymentMethodAction(MOCK_USER_ID, paymentMethodData);
    setIsSubmitting(false);
    if (result.success && result.updatedProfile) {
      setUserProfile(result.updatedProfile);
      toast({ title: "Payment Method Added", description: result.message, className: "bg-green-100 dark:bg-green-800 border-green-500" });
      setIsAddPaymentDialogOpen(false);
      reset({ type: "credit_card", name: "", last4Digits: "", upiId: "", walletBalance: undefined }); // Reset form
    } else {
      toast({ title: "Error Adding Method", description: result.message, variant: "destructive" });
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    setIsSubmitting(true);
    const result = await removePaymentMethodAction(MOCK_USER_ID, paymentMethodId);
    setIsSubmitting(false);
    if (result.success && result.updatedProfile) {
      setUserProfile(result.updatedProfile);
      toast({ title: "Payment Method Removed", description: result.message });
    } else {
      toast({ title: "Error Removing Method", description: result.message, variant: "destructive" });
    }
  };

  const CurrentGoalIcon = userProfile.goal ? defaultFinancialGoals.find(g => g.value === userProfile.goal)?.icon || Target : Target;

  if (loadingProfile) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-8rem)]">
        <User className="h-16 w-16 animate-pulse text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Your Profile...</p>
        <p className="text-sm text-muted-foreground">Personalizing your WalletWise experience.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex items-center space-x-4 mb-8 pb-4 border-b border-border">
        <User className="h-12 w-12 text-primary flex-shrink-0" />
        <div>
          <h1 className="text-3xl font-headline font-semibold text-foreground">Profile & Settings</h1>
          <p className="text-muted-foreground text-sm">{userProfile.email}</p>
        </div>
      </div>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <CurrentGoalIcon className="mr-3 h-6 w-6 text-primary" /> Financial Goal
          </CardTitle>
          <CardDescription>Set your primary financial goal to help WalletWise make smarter recommendations for you.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={userProfile.goal || ""} onValueChange={handleGoalChange} disabled={isSubmitting}>
            <SelectTrigger className="w-full rounded-md">
              <SelectValue placeholder="Select your financial goal..." />
            </SelectTrigger>
            <SelectContent>
              {defaultFinancialGoals.map((goal) => (
                <SelectItem key={goal.value} value={goal.value}>
                  <div className="flex items-center">
                    <goal.icon className="mr-2 h-5 w-5 text-muted-foreground"/>
                    {goal.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
           {isSubmitting && userProfile.goal && <p className="text-xs text-muted-foreground mt-2 animate-pulse">Updating goal...</p>}
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-xl">
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="flex items-center text-xl"><WalletIcon className="mr-3 h-6 w-6 text-primary" /> Saved Payment Methods</CardTitle>
            <CardDescription>Manage your saved cards, UPI IDs, and digital wallets.</CardDescription>
          </div>
          <Dialog open={isAddPaymentDialogOpen} onOpenChange={(isOpen) => { setIsAddPaymentDialogOpen(isOpen); if (!isOpen) reset(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-md"><PlusCircle className="mr-2 h-4 w-4" /> Add New</Button>
            </DialogTrigger>
            <DialogContent 
              className="sm:max-w-[480px] rounded-lg"
              aria-describedby={ADD_PAYMENT_DIALOG_DESCRIPTION_ID}
            >
              <DialogHeader>
                <DialogTitle>Add New Payment Method</DialogTitle>
                <DialogDescription id={ADD_PAYMENT_DIALOG_DESCRIPTION_ID}>
                  Enter the details of your new payment method. WalletWise will keep it secure.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onAddPaymentMethodSubmit)} className="space-y-4 py-2">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                        <SelectTrigger id="type" className="mt-1 rounded-md">
                          <SelectValue placeholder="Select payment type" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethodTypes.map(pmType => (
                            <SelectItem key={pmType.value} value={pmType.value}>
                               <div className="flex items-center">
                                <pmType.icon className="mr-2 h-4 w-4 text-muted-foreground"/>
                                {pmType.label}
                               </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.type && <p className="text-sm text-destructive mt-1">{errors.type.message}</p>}
                </div>
                <div>
                  <Label htmlFor="name">Name / Nickname</Label>
                  <Input id="name" {...register("name")} placeholder="e.g., My HDFC Card, Main UPI" className="mt-1 rounded-md" disabled={isSubmitting}/>
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                </div>

                {(selectedPaymentType === 'credit_card' || selectedPaymentType === 'debit_card') && (
                  <div>
                    <Label htmlFor="last4Digits">Last 4 Digits</Label>
                    <Input id="last4Digits" {...register("last4Digits")} placeholder="1234" className="mt-1 rounded-md" disabled={isSubmitting}/>
                    {errors.last4Digits && <p className="text-sm text-destructive mt-1">{errors.last4Digits.message}</p>}
                  </div>
                )}
                {selectedPaymentType === 'upi' && (
                  <div>
                    <Label htmlFor="upiId">UPI ID</Label>
                    <Input id="upiId" {...register("upiId")} placeholder="yourname@bank" className="mt-1 rounded-md" disabled={isSubmitting}/>
                    {errors.upiId && <p className="text-sm text-destructive mt-1">{errors.upiId.message}</p>}
                  </div>
                )}
                {(selectedPaymentType === 'wallet' || selectedPaymentType === 'gift_card') && (
                  <div>
                    <Label htmlFor="walletBalance">Balance (₹) (Optional)</Label>
                    <Input id="walletBalance" type="number" step="0.01" {...register("walletBalance")} placeholder="e.g. 500.00" className="mt-1 rounded-md" disabled={isSubmitting}/>
                    {errors.walletBalance && <p className="text-sm text-destructive mt-1">{errors.walletBalance.message}</p>}
                  </div>
                )}
                <DialogFooter className="pt-2">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="rounded-md" disabled={isSubmitting}>Cancel</Button>
                  </DialogClose>
                  <Button type="submit" className="rounded-md" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                     Add Method
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {userProfile.savedPaymentMethods.length > 0 ? (
            <ul className="space-y-3">
              {userProfile.savedPaymentMethods.map((method) => {
                const IconComponent = getPaymentMethodDisplayDetails(method.type).icon;
                return (
                  <li key={method.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center">
                      <IconComponent className="mr-4 h-7 w-7 text-primary flex-shrink-0" />
                      <div className="flex-grow">
                        <span className="font-medium text-foreground">{method.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {getPaymentMethodDisplayDetails(method.type).label}
                          {method.last4Digits && ` ···· ${method.last4Digits}`}
                          {method.upiId && ` - ${method.upiId}`}
                          {(method.type === 'wallet' || method.type === 'gift_card') && method.walletBalance !== undefined && ` - Balance: ₹${method.walletBalance.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemovePaymentMethod(method.id)} aria-label={`Remove ${method.name}`} disabled={isSubmitting}>
                      <Trash2 className="h-5 w-5 text-destructive hover:text-red-500" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-6">No payment methods added yet. Click 'Add New' to get started!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
