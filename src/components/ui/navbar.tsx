"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Database, Home, Menu, Network, X } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const NavItems = () => (
    <>
      <Link 
        href="/"
        className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
          isActive("/") && !pathname.startsWith("/projects") && !pathname.startsWith("/graph") ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Home className="h-4 w-4" />
        <span>Home</span>
      </Link>
      <Link 
        href="/projects"
        className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
          isActive("/projects") ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Database className="h-4 w-4" />
        <span>Projects</span>
      </Link>
      <Link 
        href="/graph"
        className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
          isActive("/graph") ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Network className="h-4 w-4" />
        <span>Graph View</span>
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl flex items-center gap-2">
            <span className="hidden md:inline">Knowledge Graph MCP</span>
            <span className="md:hidden">KG-MCP</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <NavItems />
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? 
              <X className="h-5 w-5" /> : 
              <Menu className="h-5 w-5" />
            }
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t py-4 px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <nav className="flex flex-col gap-4">
            <NavItems />
          </nav>
        </div>
      )}
    </header>
  );
} 