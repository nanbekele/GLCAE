import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { callFunction } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { cn } from "@/lib/utils";
import { ChevronLeft, ClipboardList, Loader2, MoreVertical } from "lucide-react";

interface JobSummary {
  id: string;
  title: string;
  status: string;
}

const HRJobPosts = () => {
  const { token } = useAuth();
  const { toast } = useToast();

  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobForm, setJobForm] = useState<{ id: string | null; title: string; status: string }>({
    id: null,
    title: "",
    status: "active",
  });
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      if (!token) {
        throw new Error("Missing HR authentication token. Please sign in again.");
      }

      const response = await callFunction<{ success?: boolean; jobs?: JobSummary[]; error?: string }>(
        "marketing-manage",
        {
          action: "hr-list-jobs",
        },
        {
          token,
          useAnonAuth: false,
        },
      );

      if (!response?.success) {
        throw new Error(response?.error ?? "Failed to load jobs");
      }

      setJobs(response.jobs ?? []);
    } catch (error: any) {
      console.error("[HRJobPosts] Failed to fetch jobs", error);
      toast({
        title: "Failed to load jobs",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingJobs(false);
    }
  }, [toast, token]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const handleSaveJob = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!jobForm.id) {
        toast({
          title: "No job selected",
          description: "Choose a job to edit first.",
          variant: "destructive",
        });
        return;
      }

      const trimmedTitle = jobForm.title.trim();
      if (!trimmedTitle) {
        toast({
          title: "Missing title",
          description: "Job title cannot be empty.",
          variant: "destructive",
        });
        return;
      }

      if (!token) {
        toast({
          title: "No session",
          description: "Please sign in again to manage jobs.",
          variant: "destructive",
        });
        return;
      }

      setJobSubmitting(true);
      try {
        const response = await callFunction<{ success?: boolean; job?: JobSummary; error?: string }>(
          "marketing-manage",
          {
            action: "hr-update-job",
            jobId: jobForm.id,
            title: trimmedTitle,
            status: jobForm.status,
          },
          {
            token,
            useAnonAuth: false,
          },
        );

        if (!response?.success) {
          throw new Error(response?.error ?? "Failed to save job changes");
        }

        await fetchJobs();

        toast({
          title: "Job updated",
          description: "Job details saved successfully.",
        });

        setJobForm({ id: null, title: "", status: "active" });
      } catch (error: any) {
        console.error("[HRJobPosts] Failed to update job", error);
        toast({
          title: "Failed to save job",
          description: error?.message ?? "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setJobSubmitting(false);
      }
    },
    [fetchJobs, jobForm.id, jobForm.status, jobForm.title, toast, token],
  );

  const handleDeleteJob = useCallback(
    async (job: JobSummary) => {
      if (!job?.id) return;

      const confirmed = window.confirm(`Delete the job "${job.title}"? This action cannot be undone.`);
      if (!confirmed) return;

      if (!token) {
        toast({
          title: "No session",
          description: "Please sign in again to manage jobs.",
          variant: "destructive",
        });
        return;
      }

      setJobSubmitting(true);
      try {
        const response = await callFunction<{ success?: boolean; error?: string }>(
          "marketing-manage",
          {
            action: "hr-delete-job",
            jobId: job.id,
          },
          {
            token,
            useAnonAuth: false,
          },
        );

        if (!response?.success) {
          throw new Error(response?.error ?? "Failed to delete job");
        }

        await fetchJobs();

        if (jobForm.id === job.id) {
          setJobForm({ id: null, title: "", status: "active" });
        }

        toast({
          title: "Job deleted",
          description: "The job posting has been removed.",
        });
      } catch (error: any) {
        console.error("[HRJobPosts] Failed to delete job", error);
        toast({
          title: "Failed to delete job",
          description: error?.message ?? "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setJobSubmitting(false);
      }
    },
    [fetchJobs, jobForm.id, toast, token],
  );

  const jobsSorted = useMemo(() => {
    return [...jobs].sort((a, b) => a.title.localeCompare(b.title));
  }, [jobs]);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
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
                    <span>Manage Job Posts</span>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-bold text-foreground">Manage Job Posts</h1>
            <p className="text-muted-foreground">Edit titles or statuses, or delete job postings that are no longer needed.</p>
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
              <ClipboardList className="h-5 w-5" />
              Job Postings
            </CardTitle>
            <CardDescription>{loadingJobs ? "Refreshing job list…" : `${jobs.length} jobs loaded.`}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-end">
              <Button size="sm" variant="secondary" onClick={() => void fetchJobs()} disabled={loadingJobs}>
                {loadingJobs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobsSorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        {loadingJobs ? "Loading…" : "No job postings yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobsSorted.map((job) => (
                      <TableRow key={job.id} className={cn(jobForm.id === job.id && "bg-muted/50")}>
                        <TableCell>{job.title}</TableCell>
                        <TableCell className="capitalize">{job.status}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setJobForm({ id: job.id, title: job.title, status: job.status })}>
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => void handleDeleteJob(job)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {jobForm.id ? (
              <form onSubmit={handleSaveJob} className="space-y-4 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Edit Job</h3>
                  <Button type="button" variant="ghost" onClick={() => setJobForm({ id: null, title: "", status: "active" })}>
                    Cancel Edit
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="job-manager-title">Title</Label>
                    <Input
                      id="job-manager-title"
                      value={jobForm.title}
                      onChange={(event) => setJobForm((prev) => ({ ...prev, title: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="job-manager-status">Status</Label>
                    <Select value={jobForm.status} onValueChange={(value) => setJobForm((prev) => ({ ...prev, status: value }))}>
                      <SelectTrigger id="job-manager-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="submit" disabled={jobSubmitting}>
                    {jobSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HRJobPosts;
