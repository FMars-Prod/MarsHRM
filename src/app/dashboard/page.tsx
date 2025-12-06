import { AnnouncementsWidget } from "@/components/geohrm/announcements-widget";
import { AttendanceWidget } from "@/components/geohrm/attendance-widget";
import { EventsWidget } from "@/components/geohrm/events-widget";
import { PageHeader } from "@/components/geohrm/page-header";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome back, here's your overview for today."
      />
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <AttendanceWidget />
        </div>
        <div className="lg:col-span-1 xl:col-span-1">
          <AnnouncementsWidget />
        </div>
        <div className="lg:col-span-2 xl:col-span-1">
          <EventsWidget />
        </div>
      </div>
    </>
  );
}
