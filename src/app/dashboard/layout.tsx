import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { MainNav } from "@/components/geohrm/main-nav";
import { UserNav } from "@/components/geohrm/user-nav";
import { Building2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                <Building2 className="h-6 w-6" />
            </div>
            <span className="font-headline text-lg font-semibold">GeoHRM</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
            <MainNav />
        </SidebarContent>
        <SidebarFooter>
            <UserNav />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
            <SidebarTrigger className="md:hidden"/>
            <div className="flex-1">
                {/* Placeholder for breadcrumbs or page title if needed */}
            </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
