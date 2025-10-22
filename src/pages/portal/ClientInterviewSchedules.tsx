import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CalendarDays } from "lucide-react";
import { fetchInterviewSchedulesForClient, type InterviewScheduleLog } from "@/lib/portalRequests";

const ClientInterviewSchedules = () => {
  const { profile, token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interviews, setInterviews] = useState<InterviewScheduleLog[]>([]);

  const load = async () => {
    if (!profile?.email) {
      setInterviews([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchInterviewSchedulesForClient(profile.email, 200, token);
      setInterviews(rows);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load interviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.email]);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/client-portal">Back to Dashboard</Link>
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Refresh
          </Button>
        </div>

        <Card className="shadow-card border-card-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              <span>Interview Schedules</span>
            </CardTitle>
            <CardDescription>All interviews scheduled for {profile?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading ...
              </div>
            ) : interviews.length === 0 ? (
              <CardDescription>No interviews scheduled.</CardDescription>
            ) : (
              <div className="space-y-2">
                {interviews
                  .sort((a, b) => +(new Date(b.scheduled_for)) - +(new Date(a.scheduled_for)))
                  .map((iv) => (
                    <div key={iv.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-foreground">{iv.position}</div>
                          <div className="text-xs text-muted-foreground">
                            Interviewer: {iv.interviewer} ({iv.interviewer_email})
                          </div>
                          <div className="text-xs text-muted-foreground">
                            When: {new Date(iv.scheduled_for).toLocaleString()} · {iv.location}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline">Interview</Badge>
                        </div>
                      </div>
                      {iv.notes ? <p className="mt-2 text-sm text-muted-foreground">{iv.notes}</p> : null}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientInterviewSchedules;
