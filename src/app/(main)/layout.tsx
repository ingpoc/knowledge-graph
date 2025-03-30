import { Navbar } from "@/components/ui/navbar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="py-6 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Knowledge Graph MCP - AI Agent Context Protocol
        </div>
      </footer>
    </div>
  );
} 