
import { PageHeader } from "@/components/geohrm/page-header";

export default function NewPage() {
  return (
    <>
      <PageHeader
        title="New Page"
        description="This is a new page. You can add your content here."
      />
      <div className="border rounded-lg p-6 min-h-[400px] flex items-center justify-center">
        <p className="text-muted-foreground">Your content goes here.</p>
      </div>
    </>
  );
}
