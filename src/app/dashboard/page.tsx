
// @ts-nocheck
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart as BarChartIcon, DollarSign, Target, ListFilter, TrendingUp, PiggyBank, BriefcaseBusiness, Plane, Filter } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts";
import { transactionCategories, mockUserProfile as initialUserProfile, financialGoals as defaultFinancialGoals, MOCK_USER_ID } from '@/lib/mockData';
import type { Transaction, UserProfile, FinancialGoal } from '@/lib/types';
import { getMockUserProfileServer } from '@/lib/actions'; 
import { firestore } from '@/lib/firebase'; 
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore'; 

const chartConfig = {
  savings: {
    label: "Savings (₹)",
    color: "hsl(var(--accent))",
    icon: DollarSign,
  },
};

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(initialUserProfile);
  const [filteredCategory, setFilteredCategory] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [randomGoalProgress, setRandomGoalProgress] = useState<number | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      console.log("Dashboard: Fetching profile and transaction data directly from Firestore...");
      try {
        const profileData = await getMockUserProfileServer();
        setUserProfile(profileData);
        console.log("Dashboard: Profile data fetched:", profileData);

        let fetchedTransactions: Transaction[] = [];
        if (!firestore) {
          console.error("Dashboard: Firestore is not initialized. Cannot fetch transactions.");
        } else {
          try {
            const transactionsCol = collection(firestore, "transactions");
            const q = query(transactionsCol, where("userId", "==", MOCK_USER_ID), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            console.log(`Dashboard: Firestore query for userId '${MOCK_USER_ID}' returned ${querySnapshot.docs.length} documents.`);

            querySnapshot.forEach((doc) => {
              const data = doc.data();
              let transactionDateString: string;

              if (typeof data.date === 'string') {
                transactionDateString = data.date;
              } else if (data.createdAt instanceof Timestamp) {
                transactionDateString = data.createdAt.toDate().toISOString();
              } else if (data.date instanceof Timestamp) {
                transactionDateString = data.date.toDate().toISOString();
              } else {
                console.warn(`Dashboard: Transaction doc.id ${doc.id} missing valid date or createdAt Timestamp. Using current date as fallback.`);
                transactionDateString = new Date().toISOString();
              }

              fetchedTransactions.push({
                id: doc.id,
                amount: data.amount,
                date: transactionDateString,
                paymentMethodUsed: data.paymentMethodUsed,
                category: data.category,
                offerApplied: data.offerApplied,
                savings: data.savings,
              } as Transaction);
            });
          } catch (dbError) {
            console.error("Dashboard: Error fetching transactions directly from Firestore:", dbError);
            // Decide how to handle DB errors, e.g., show a toast or message
            // For now, transactions will remain empty.
          }
        }
        setTransactions(fetchedTransactions || []);
        console.log("Dashboard: Transactions data fetched directly:", fetchedTransactions);

      } catch (error) {
        console.error("Dashboard: Error fetching initial data (profile or transactions wrapper):", error);
        setTransactions([]);
      }
      setLoading(false);
      console.log("Dashboard: Fetching complete, loading set to false.");
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (userProfile.goal !== 'savings') {
        setRandomGoalProgress(Math.random() * 70 + 20);
    }
  }, [userProfile.goal]);


  const currentGoalDetails = defaultFinancialGoals.find(g => g.value === userProfile.goal);

  const totalCumulativeSavings = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.savings || 0), 0);
  }, [transactions]);

  const totalSavingsThisMonth = useMemo(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    console.log("Dashboard: Calculating totalSavingsThisMonth. Current month:", currentMonth, "Current year:", currentYear, "Transactions count:", transactions.length);

    return transactions.reduce((sum, t) => {
      if (!t.date) return sum;
      const transactionDate = new Date(t.date);
      if (isNaN(transactionDate.getTime())) {
          console.warn("Dashboard: Invalid date encountered in transaction for totalSavingsThisMonth:", t);
          return sum;
      }
      if (
        transactionDate.getMonth() === currentMonth &&
        transactionDate.getFullYear() === currentYear &&
        t.savings // Ensures savings is a truthy value (e.g. > 0)
      ) {
        return sum + t.savings;
      }
      return sum;
    }, 0);
  }, [transactions]);


  const goalProgressValue = useMemo(() => {
    if (userProfile.goal === 'savings') {
      return Math.min((totalCumulativeSavings / 5000) * 100, 100);
    }
    return randomGoalProgress !== null ? randomGoalProgress : 0;
  }, [userProfile.goal, totalCumulativeSavings, randomGoalProgress]);


  const filteredTransactions = useMemo(() => transactions.filter(
    (t) => filteredCategory === "All" || t.category === filteredCategory
  ), [transactions, filteredCategory]);

  const monthlySavingsChartData = useMemo(() => {
    const savingsByMonth: { [key: string]: number } = {};

    transactions.forEach(transaction => {
      if (transaction.savings && transaction.savings > 0 && transaction.date) {
        const date = new Date(transaction.date);
        if (isNaN(date.getTime())) {
            console.warn("Dashboard: Invalid date encountered in transaction for monthlySavingsChartData:", transaction);
            return;
        }
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        savingsByMonth[monthKey] = (savingsByMonth[monthKey] || 0) + transaction.savings;
      }
    });

    const chartData = [];
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentDate = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = monthLabels[date.getMonth()];

      chartData.push({
        month: monthName,
        savings: savingsByMonth[monthKey] || 0,
      });
    }
    return chartData;
  }, [transactions]);

  console.log("Dashboard Render State: transactions count:", transactions.length, transactions);
  console.log("Dashboard Render State: totalSavingsThisMonth:", totalSavingsThisMonth);
  console.log("Dashboard Render State: loading:", loading);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-8rem)]">
        <TrendingUp className="h-16 w-16 animate-pulse text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Your Dashboard...</p>
        <p className="text-sm text-muted-foreground">Crunching numbers and preparing insights!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-headline font-semibold text-foreground">My Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-md hover:shadow-lg transition-shadow rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Savings (This Month)</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">₹{totalSavingsThisMonth.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Savings accumulated this calendar month.</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Financial Goal Progress</CardTitle>
            {currentGoalDetails?.icon ? <currentGoalDetails.icon className="h-5 w-5 text-accent" /> : <Target className="h-5 w-5 text-accent" />}
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold mb-1 text-foreground">
              {currentGoalDetails ? currentGoalDetails.label : "No Goal Set"}
            </div>
            {currentGoalDetails && (
                <>
                <Progress value={goalProgressValue} aria-label={`${goalProgressValue.toFixed(0)}% towards ${currentGoalDetails.label}`} className="h-3 my-2" />
                <p className="text-xs text-muted-foreground">
                    {goalProgressValue.toFixed(0)}% of your target. Keep it up!
                </p>
                </>
            )}
            {!currentGoalDetails && (
                 <p className="text-xs text-muted-foreground">
                    Set a financial goal in your profile to track progress.
                </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Payment Methods</CardTitle>
            <PiggyBank className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{userProfile.savedPaymentMethods.length}</div>
            <p className="text-xs text-muted-foreground">
              {userProfile.savedPaymentMethods.filter(pm => pm.type === 'credit_card').length} Credit Cards, {userProfile.savedPaymentMethods.filter(pm => pm.type === 'wallet').length} Wallets
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-foreground">
            <BarChartIcon className="mr-2 h-6 w-6 text-primary" />
            Monthly Savings Overview
          </CardTitle>
          <CardDescription>Estimated savings over the last 6 months based on your transactions.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] p-2 sm:p-6">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={monthlySavingsChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
                  content={<ChartTooltipContent indicator="dot" hideLabel />}
                />
                <Bar dataKey="savings" fill="var(--color-savings)" radius={[4, 4, 0, 0]} barSize={40} />
                 <ChartLegend content={<ChartLegendContent />} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center text-foreground">
                <ListFilter className="mr-2 h-6 w-6 text-primary" />
                Recent Transactions
              </CardTitle>
              <CardDescription>View your latest spending and savings.</CardDescription>
            </div>
            <Select value={filteredCategory} onValueChange={setFilteredCategory}>
              <SelectTrigger className="w-full sm:w-[220px] rounded-md">
                 <Filter className="mr-2 h-4 w-4 text-muted-foreground"/>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {transactionCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category === "All" ? "All Categories" : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount (₹)</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Savings (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...filteredTransactions] 
                    .sort((a, b) => {
                      const dateA = new Date(a.date);
                      const dateB = new Date(b.date);
                      if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
                      if (isNaN(dateA.getTime())) return 1; 
                      if (isNaN(dateB.getTime())) return -1; 
                      return dateB.getTime() - dateA.getTime(); 
                    })
                    .slice(0, 10)
                    .map((transaction) => {
                      let displayDate = 'N/A';
                      if (transaction.date) {
                          const dateObj = new Date(transaction.date);
                          if (!isNaN(dateObj.getTime())) {
                              displayDate = dateObj.toLocaleDateString();
                          } else {
                              console.warn("Dashboard: Invalid date in transaction for recent transactions list:", transaction);
                          }
                      }
                      return (
                          <TableRow key={transaction.id}>
                            <TableCell className="min-w-[100px]">{displayDate}</TableCell>
                            <TableCell className="font-medium text-foreground">{transaction.category}</TableCell>
                            <TableCell>{transaction.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-muted-foreground">{transaction.paymentMethodUsed.name}</TableCell>
                            <TableCell className="text-right font-medium" style={{color: transaction.savings && transaction.savings > 0 ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground))'}}>
                              {transaction.savings ? `${transaction.savings.toFixed(2)}` : '-'}
                            </TableCell>
                          </TableRow>
                      );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
             <div className="text-center py-10 text-muted-foreground">
                <TrendingUp className="h-16 w-16 mx-auto mb-3 opacity-50" />
                <p className="text-lg">No transactions found for &quot;{filteredCategory}&quot;.</p>
                <p className="text-sm">Try a different category or make some purchases!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

