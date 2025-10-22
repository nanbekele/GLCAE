import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { PortalRequestManager, type SentRequest } from "@/components/portal/PortalRequestManager";
import { ChevronLeft, Inbox } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { createClientServiceRequest, uploadServiceRequestAttachments } from "@/lib/portalRequests";
import type { Database } from "@/integrations/supabase/types";

type ServiceRequestRow = Database["public"]["Tables"]["service_requests"]["Row"];

const ClientServiceRequests = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(
    async (request: SentRequest) => {
      if (!profile?.id) {
        toast({
          title: "Not signed in",
          description: "Please sign in to submit a service request.",
          variant: "destructive",
        });
        throw new Error("Not authenticated");
      }

      try {
        setSaving(true);

        const attachmentsMetadata = request.originalFiles && request.originalFiles.length > 0
          ? await uploadServiceRequestAttachments(request.originalFiles)
          : [];

        await createClientServiceRequest({
          clientId: profile.id,
          title: request.title,
          description: request.details,
          serviceType: "HR",
          priority: "medium",
          attachments: attachmentsMetadata,
        });
      } catch (error: any) {
        console.error("[ClientServiceRequests] Failed to submit", error);
        toast({
          title: "Failed to submit",
          description: error?.message ?? "Please try again later.",
          variant: "destructive",
        });
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [profile?.id, toast],
  );

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/client-portal">Client Portal</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <span>Service Requests</span>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-bold text-foreground">Service Requests</h1>
            <p className="text-muted-foreground">
              Submit support tickets to the HR coordination team, share with other departments, and keep track of your recent submissions.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/client-portal">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>

        <Card className="border-card-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Create & Track Requests
            </CardTitle>
            <CardDescription>
              Use the request center below to send new service requests, attach supporting documents, and review previously submitted items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PortalRequestManager
              trigger={
                <Button className="w-full justify-center" size="lg" disabled={saving}>
                  <Inbox className="mr-2 h-4 w-4" />
                  {saving ? "Submitting..." : "New service request"}
                </Button>
              }
              actorLabel="Client"
              actorDepartment="Client"
              departments={["HR"]}
              enableReceived={false}
              initialSent={[]}
              sendToDepartment="HR"
              allowShareSelection={false}
              onSendRequest={handleSubmit}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientServiceRequests;
