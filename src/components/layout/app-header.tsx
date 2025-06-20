// @ts-nocheck
"use client";

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Wallet, LayoutDashboard, UserCircle, ShoppingCart } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Menu, LogOut, Settings } from 'lucide-react'; // Added LogOut and Settings
import { useState, useEffect } from 'react';
import { MOCK_USER_ID, mockUserProfile } from '@/lib/mockData'; // For Avatar Fallback

const navLinks = [
  { href: "/", label: "Checkout", icon: ShoppingCart },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export default function AppHeader() {
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarFallback, setAvatarFallback] = useState("UW");

  useEffect(() => {
    // Create a fallback from the user's email if possible
    const emailParts = mockUserProfile.email.split('@')[0].split('.');
    let initials = "UW"; // Default WalletWise
    if (emailParts.length > 0) {
      if (emailParts.length === 1) {
        initials = emailParts[0].substring(0, 2).toUpperCase();
      } else {
        initials = (emailParts[0][0] + (emailParts[1][0] || '')).toUpperCase();
      }
    }
    setAvatarFallback(initials);
  }, []);


  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Wallet className="h-8 w-8 text-primary transition-transform group-hover:rotate-[15deg] duration-300" />
          <span className="text-xl font-bold font-headline text-primary">WalletWise</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => (
            <Button key={link.href} variant="ghost" asChild className="text-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors px-4 py-2">
              <Link href={link.href}>
                <link.icon className="mr-2 h-4 w-4" />
                {link.label}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label="Toggle theme"
            suppressHydrationWarning={true}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <div className="hidden md:block">
            <UserMenu avatarFallback={avatarFallback} />
          </div>
          
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className="rounded-full" suppressHydrationWarning={true}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[260px] p-0 flex flex-col">
                <div className="p-4 border-b">
                     <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                        <Wallet className="h-7 w-7 text-primary" />
                        <span className="text-lg font-bold font-headline text-primary">WalletWise</span>
                      </Link>
                </div>
                <nav className="flex flex-col p-4 space-y-1 flex-grow">
                  {navLinks.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <Link
                        href={link.href}
                        className="flex items-center gap-3 rounded-md px-3 py-3 text-sm hover:bg-muted transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <link.icon className="h-5 w-5 text-muted-foreground" />
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
                <div className="mt-auto p-4 border-t">
                  <UserMenu isMobile avatarFallback={avatarFallback} onLinkClick={() => setMobileMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}


function UserMenu({ isMobile = false, avatarFallback, onLinkClick }: { isMobile?: boolean, avatarFallback: string, onLinkClick?: () => void }) {
  const commonTrigger = (
    <Avatar className={`h-9 w-9 border-2 border-primary/50 hover:border-primary transition-all ${isMobile ? 'mb-2' : ''}`}>
      <AvatarImage src={`https://placehold.co/40x40.png?text=${avatarFallback}`} alt="User Avatar" data-ai-hint="user avatar" />
      <AvatarFallback className="bg-muted text-primary font-semibold">{avatarFallback}</AvatarFallback>
    </Avatar>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col space-y-1">
         <SheetClose asChild>
          <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-3 text-sm" asChild suppressHydrationWarning={true}>
            <Link href="/profile" onClick={onLinkClick}>
              <UserCircle className="h-5 w-5 text-muted-foreground" />
              Profile
            </Link>
          </Button>
        </SheetClose>
         <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-3 text-sm text-muted-foreground" disabled suppressHydrationWarning={true}>
          <Settings className="h-5 w-5" />
          Settings (Soon)
        </Button>
         <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-3 text-sm text-muted-foreground" disabled suppressHydrationWarning={true}>
          <LogOut className="h-5 w-5" />
          Logout (Soon)
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" suppressHydrationWarning={true}>
          {commonTrigger}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center cursor-pointer">
            <UserCircle className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="cursor-not-allowed">
           <Settings className="mr-2 h-4 w-4" />
          <span>Settings (Coming Soon)</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="cursor-not-allowed">
           <LogOut className="mr-2 h-4 w-4" />
          <span>Logout (Coming Soon)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
