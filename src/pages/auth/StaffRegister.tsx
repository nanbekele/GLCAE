import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus } from 'lucide-react';
import logo from '@/assets/MIG-Logo2.jpg';
import { useToast } from '@/hooks/use-toast';
import { callFunction } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const StaffRegister = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    phone: '',
    department: '',
    role: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [lastRegisteredEmail, setLastRegisteredEmail] = useState<string | null>(null);
  const { toast } = useToast();
  const { token, profile } = useAuth();

  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const departments = [
    'Architectural & Civil',
    'Electrical',
    'Mechanical',
    'ICT',
    'Material Testing',
    'Consultancy'
  ];

  const roles = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'hr_staff', label: 'HR Staff' },
    { value: 'architectural_civil_head', label: 'Architectural & Civil Head' },
    { value: 'mechanical_head', label: 'Mechanical Head' },
    { value: 'ict_head', label: 'ICT Head' },
    { value: 'material_testing_head', label: 'Material Testing Head' },
    { value: 'marketing_communications', label: 'Marketing Communications' },
    { value: 'employee', label: 'Employee' }
  ];

  // Password is generated on the server as firstName@123. No client-side generation needed.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.role) return;
    if (!token) {
      toast({
        title: 'Authentication required',
        description: 'You must be signed in to register staff members.',
        variant: 'destructive',
      });
      return;
    }

    if (profile?.role !== 'super_admin' && profile?.role !== 'hr_staff') {
      toast({
        title: 'Unauthorized',
        description: 'Only Super Admin or HR Staff can register new staff.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await callFunction<{ profile: { full_name: string; email: string; role: string } | null; password?: string }>(
        'marketing-manage',
        {
          action: 'hr-create-staff',
          email: formData.email,
          fullName: formData.fullName,
          role: formData.role,
          department: formData.department || null,
          position: formData.role,
          phone: formData.phone || null,
        },
        { token, useAnonAuth: false }
      );

      setGeneratedPassword(response.password ?? null);
      setLastRegisteredEmail(formData.email);

      toast({
        title: 'Registration Successful',
        description: `Staff member registered. Email: ${formData.email}. Default password shown below.`,
      });

      setFormData({
        fullName: '',
        age: '',
        phone: '',
        department: '',
        role: '',
        email: ''
      });
    } catch (error: any) {
      toast({
        title: "Registration Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden shadow">
              <img src={logo} alt="GCAE Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">GCAE</div>
              <div className="text-sm text-muted-foreground">Staff Registration</div>
            </div>
          </div>
        </div>

        <Card className="shadow-corporate border-card-border">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-foreground flex items-center justify-center space-x-2">
              <UserPlus size={24} />
              <span>Register Staff Member</span>
            </CardTitle>
            <CardDescription className="text-center">
              Internal staff registration for HR and administrative use
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select value={formData.department} onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> Default password format is <code>firstName@123</code> (e.g. <code>nanbon@123</code>). It will be displayed after registration.
                </p>
              </div>

              {generatedPassword && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-semibold">Generated Credentials</p>
                  <p className="text-xs mt-1">Email: {lastRegisteredEmail ?? formData.email}</p>
                  <p className="text-xs">Password: {generatedPassword}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled={loading || !formData.fullName || !formData.email || !formData.role}
              >
                {loading ? 'Registering...' : 'Register Staff Member'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaffRegister;