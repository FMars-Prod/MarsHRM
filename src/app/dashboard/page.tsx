
import { ActionItemsWidget } from "@/components/geohrm/action-items-widget";
import { AnnouncementsWidget } from "@/components/geohrm/announcements-widget";
import { AttendanceWidget } from "@/components/geohrm/attendance-widget";
import { EventsWidget } from "@/components/geohrm/events-widget";
import { PageHeader } from "@/components/geohrm/page-header";
import { TeamOverviewWidget } from "@/components/geohrm/team-overview-widget";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome back, here's your overview for today."
      >
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <AttendanceWidget />
          <ActionItemsWidget />
          <TeamOverviewWidget />
        </div>
        <div className="lg:col-span-1">
          <AnnouncementsWidget />
        </div>
        <div className="lg:col-span-1">
          <EventsWidget />
        </div>
      </div>
    </>
  );
}
