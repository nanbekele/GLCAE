import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TestResult {
  email: string;
  status: 'success' | 'error' | 'skipped';
  message: string;
}

interface CreateResponse {
  success: boolean;
  message: string;
  results: TestResult[];
  summary: {
    total: number;
    successful: number;
    errors: number;
    skipped: number;
  };
}

const CreateTestUsers = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CreateResponse | null>(null);
  const { toast } = useToast();

  const createTestUsers = async () => {
    setLoading(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-test-users');

      if (error) {
        throw error;
      }

      setResults(data);
      
      if (data.success) {
        toast({
          title: "Test Users Created",
          description: data.message,
        });
      } else {
        toast({
          title: "Creation Failed",
          description: data.error || 'Unknown error occurred',
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error creating test users:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to create test users',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Users size={24} className="text-primary-foreground" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">Test User Creation</div>
              <div className="text-sm text-muted-foreground">GCAE Development Tool</div>
            </div>
          </div>
        </div>

        <Card className="shadow-corporate border-card-border">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-foreground flex items-center justify-center space-x-2">
              <Users size={24} />
              <span>Create Test Users</span>
            </CardTitle>
            <CardDescription className="text-center">
              Create default test accounts for all role-based users in the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Test users to be created:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>• Super Admin (admin@gcae.com)</div>
                <div>• HR Staff (hr@gcae.com)</div>
                <div>• Architectural Head (arch.head@gcae.com)</div>
                <div>• Electrical Head (elec.head@gcae.com)</div>
                <div>• Mechanical Head (mech.head@gcae.com)</div>
                <div>• ICT Head (ict.head@gcae.com)</div>
                <div>• Material Testing Head (testing.head@gcae.com)</div>
                <div>• Consultancy Head (consult.head@gcae.com)</div>
                <div>• Marketing Manager (marketing@gcae.com)</div>
                <div>• Employee (employee@gcae.com)</div>
                <div>• Client (client@gcae.com)</div>
              </div>
            </div>

            <Button
              onClick={createTestUsers}
              disabled={loading}
              className="w-full h-12 bg-gradient-primary hover:opacity-90"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating Test Users...</span>
                </div>
              ) : (
                'Create All Test Users'
              )}
            </Button>

            {results && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>Total: {results.summary.total}</div>
                    <div className="text-green-600">Success: {results.summary.successful}</div>
                    <div className="text-yellow-600">Skipped: {results.summary.skipped}</div>
                    <div className="text-red-600">Errors: {results.summary.errors}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Detailed Results:</h3>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {results.results.map((result, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                        {getStatusIcon(result.status)}
                        <span className="font-mono text-sm flex-1">{result.email}</span>
                        <span className="text-xs text-muted-foreground">{result.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This tool creates test accounts for development purposes. 
                Existing users will be skipped. Check the TEST_USERS.md file for login credentials.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateTestUsers;