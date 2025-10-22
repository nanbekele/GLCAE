import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Search, MapPin, Clock, Users, Award, Target, Heart, TrendingUp, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  title: string;
  department_id?: string;
  location: string;
  type: string;
  description: string;
  requirements: string;
  responsibilities: string;
  salary_range?: string;
  posted_at: string;
  closes_at?: string;
  status?: string;
}

const Careers = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const departments = [
    { id: 'all', name: 'All Departments' },
    { id: 'architecture', name: 'Architecture & Civil' },
    { id: 'mechanical', name: 'Mechanical Engineering' },
    { id: 'electrical', name: 'Electrical Engineering' },
    { id: 'ict', name: 'ICT Solutions' },
    { id: 'testing', name: 'Material Testing' },
    { id: 'consultancy', name: 'Consultancy' },
  ];

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    filterJobs();
  }, [jobs, searchTerm, selectedDepartment]);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'active')
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterJobs = () => {
    let filtered = jobs;

    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(job => job.department_id === selectedDepartment);
    }

    if (searchTerm) {
      filtered = filtered.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredJobs(filtered);
  };

  // Open the application form for the first available job.
  // If no jobs are available, scroll to the openings section as a fallback.
  const openApplicationForm = () => {
    if (!profile?.id) {
      toast({ title: 'Login required', description: 'you must be login to apply', variant: 'destructive' });
      return;
    }
    const target = filteredJobs[0] ?? jobs[0];
    if (target?.id) {
      navigate(`/careers/apply/${target.id}`);
    } else {
      document.getElementById('current-openings')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary via-primary/90 to-accent py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-primary-foreground mb-6 animate-fade-in">
              Join Our <span className="text-accent">Team</span>
            </h1>
            <p className="text-xl text-primary-foreground/90 mb-8 leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Build your career with GCAE, where innovation meets excellence in engineering and architecture
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <Button 
                size="lg" 
                variant="secondary" 
                className="px-8 py-4 hover:scale-105 transition-transform"
                onClick={() => document.getElementById('current-openings')?.scrollIntoView({ behavior: 'smooth' })}
              >
                View Open Positions
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 py-4 text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary hover:scale-105 transition-all"
                onClick={() => document.getElementById('why-choose-gcae')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn About Our Culture
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Our Company */}
      <section id="why-choose-gcae" className="py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Why Choose <span className="text-primary">GCAE</span>?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Join a company that values innovation, growth, and excellence in everything we do
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: TrendingUp,
                title: 'Career Growth',
                description: 'Continuous learning opportunities and clear career advancement paths'
              },
              {
                icon: Users,
                title: 'Collaborative Culture',
                description: 'Work with talented professionals in a supportive team environment'
              },
              {
                icon: Award,
                title: 'Industry Recognition',
                description: 'Be part of award-winning projects that shape Ethiopia\'s infrastructure'
              },
              {
                icon: Heart,
                title: 'Work-Life Balance',
                description: 'Comprehensive benefits and flexible working arrangements'
              }
            ].map((benefit, index) => (
              <Card 
                key={index}
                className="text-center group hover:shadow-corporate transition-all duration-300 border-card-border hover:border-primary/20 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <benefit.icon size={32} className="text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {benefit.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Job Search Section */}
      <section id="current-openings" className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Current <span className="text-primary">Openings</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Discover exciting career opportunities across our specialized departments
            </p>
          </div>

          {/* Search and Filter */}
          <div className="bg-secondary rounded-2xl p-6 mb-8 shadow-card">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search jobs by title or keywords..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={20} className="text-muted-foreground" />
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Filter by Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredJobs.length} position{filteredJobs.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Jobs List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading positions...</p>
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="space-y-6">
              {filteredJobs.map((job, index) => (
                <Card 
                  key={job.id}
                  className="group hover:shadow-corporate transition-all duration-300 border-card-border hover:border-primary/20 animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                          {job.title}
                        </CardTitle>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin size={16} className="text-primary" />
                            {job.location}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={16} className="text-primary" />
                            {job.type}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users size={16} className="text-primary" />
                            {departments.find((d) => d.id === job.department_id)?.name || "General"}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-start md:items-end">
                        <Badge
                          variant={job.status === "active" ? "default" : "outline"}
                          className={cn(
                            "uppercase",
                            job.status === "active"
                              ? "bg-success text-success-foreground"
                              : "text-muted-foreground border-muted-foreground/50",
                          )}
                        >
                          {job.status === "active" ? "Open" : "Closed"}
                        </Badge>
                        {job.salary_range && (
                          <Badge variant="secondary" className="text-center">
                            {job.salary_range}
                          </Badge>
                        )}
                        <div className="text-sm text-muted-foreground">
                          Posted: {formatDate(job.posted_at)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-muted-foreground leading-relaxed mb-4 line-clamp-3">
                      {job.description}
                    </CardDescription>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        className="w-full sm:flex-1 hover:scale-105 transition-transform"
                        onClick={() => {
                          if (!profile?.id) {
                            toast({ title: 'Login required', description: 'you must be login to apply', variant: 'destructive' });
                            return;
                          }
                          navigate(`/careers/apply/${job.id}`);
                        }}
                      >
                        Apply Now
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full sm:flex-1 hover:scale-105 transition-transform"
                        onClick={() => navigate(`/careers/job/${job.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users size={64} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Positions Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedDepartment !== 'all' 
                  ? 'Try adjusting your search criteria'
                  : 'No open positions at the moment. Check back soon!'
                }
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Apply Online CTA */}
      <section className="py-16 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <Target size={48} className="mx-auto text-accent mb-6" />
            <h2 className="text-4xl font-bold text-primary-foreground mb-6">
              Ready to Apply?
            </h2>
            <p className="text-xl text-primary-foreground/90 mb-8 leading-relaxed">
              Join GCAE and be part of Ethiopia's leading engineering and architectural consultancy firm. 
              Your career growth starts here.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary" 
                className="px-8 py-4 hover:scale-105 transition-transform"
                onClick={openApplicationForm}
              >
                Submit Your Resume
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 py-4 text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary hover:scale-105 transition-all"
                onClick={() => window.location.href = '/contact'}
              >
                Contact HR Team
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Careers;