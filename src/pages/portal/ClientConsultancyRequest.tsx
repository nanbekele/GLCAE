import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { createConsultancyRequest } from "@/lib/portalRequests";

const DEPARTMENTS = [
  "ICT",
  "Mechanical",
  "Material Testing",
  "Architectural & Civil",
] as const;

const ClientConsultancyRequest = () => {
  const { profile, token } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [department, setDepartment] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!email && profile?.email) setEmail(profile.email);
  }, [profile?.email, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) {
      toast({ title: "Not signed in", description: "Please sign in to submit a request.", variant: "destructive" });
      return;
    }
    if (!department) {
      toast({ title: "Department required", description: "Please select a department.", variant: "destructive" });
      return;
    }
    if (!email.trim()) {
      toast({ title: "Email required", description: "Please enter your contact email.", variant: "destructive" });
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast({ title: "Missing fields", description: "Please provide a title and description.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const prefixedTitle = `Consultancy: ${title.trim()}`;
      await createConsultancyRequest({
        clientId: profile.id,
        department: department as any,
        title: prefixedTitle,
        description: description.trim(),
        token,
        contactEmail: email.trim(),
      });
      toast({ title: "Submitted", description: "Your consultancy request has been sent." });
      navigate("/client-portal");
    } catch (err: any) {
      toast({ title: "Submit failed", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Request Consultancy</h1>
            <p className="text-muted-foreground">Select the department and describe your consultancy need.</p>
          </div>
          <Link to="/client-portal"><Button variant="secondary"><ArrowLeft className="h-4 w-4 mr-2"/>Back to Dashboard</Button></Link>
        </div>

        <Card className="shadow-card border-card-border">
          <CardHeader>
            <CardTitle>Consultancy Form</CardTitle>
            <CardDescription>We will route your request to the selected department head.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select department"/></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="grid gap-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title" />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your requirements" rows={6}/>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={submitting}>{submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Submitting...</span> : "Submit"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientConsultancyRequest;
