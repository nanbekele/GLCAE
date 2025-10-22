import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CalendarDays } from "lucide-react";
import { fetchConsultancyRequestsForClient, type ConsultancyRequestRow } from "@/lib/portalRequests";

const ClientConsultancySchedules = () => {
  const { profile, token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ConsultancyRequestRow[]>([]);

  const load = async () => {
    if (!profile?.id) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchConsultancyRequestsForClient(profile.id, 200, token);
      setItems(rows);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load consultancy schedules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

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
              <span>Consultancy Schedules</span>
            </CardTitle>
            <CardDescription>All consultancy sessions for your account</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading ...
              </div>
            ) : items.length === 0 ? (
              <CardDescription>No consultancy requests.</CardDescription>
            ) : (
              <div className="space-y-2">
                {items
                  .sort((a, b) => +(new Date(b.schedule_at ?? b.created_at)) - +(new Date(a.schedule_at ?? a.created_at)))
                  .map((c) => (
                    <div key={c.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-foreground">{c.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.schedule_at ? `Scheduled: ${new Date(c.schedule_at).toLocaleString()}` : 'Not scheduled yet'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{c.department}</div>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="uppercase">Consultancy</Badge>
                          <Badge variant="secondary">{c.status}</Badge>
                        </div>
                      </div>
                      {c.description ? <p className="mt-2 text-sm text-muted-foreground">{c.description}</p> : null}
                      {c.notes ? <p className="mt-1 text-xs text-muted-foreground">Notes: {c.notes}</p> : null}
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

export default ClientConsultancySchedules;
