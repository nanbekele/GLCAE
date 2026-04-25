import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useToast } from "@/hooks/use-toast";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { ChevronLeft, Briefcase } from "lucide-react";
import { PostJobForm } from "@/components/hr/PostJobDialog";

const HRPostJob = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleClose = useCallback(() => {
    navigate("/portal/hr");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/portal/hr">HR Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <span>Post New Job</span>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-bold text-foreground">Post New Job</h1>
            <p className="text-muted-foreground">
              Provide the job details below. Published roles will appear on the Careers page.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/portal/hr">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>

        <Card className="border-card-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Job Details
            </CardTitle>
            <CardDescription>
              Fill all required fields then click Publish Job.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PostJobForm
              enabled={true}
              onJobCreated={() => {
                toast({
                  title: "Job posted",
                  description: "The job vacancy has been published successfully.",
                });
                navigate("/portal/hr");
              }}
              onClose={handleClose}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HRPostJob;
