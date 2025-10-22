import { Users, Target, CheckCircle, BarChart3, FileText, Award } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const Consultancy = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const services = [
    {
      title: 'Project Management',
      description: 'End-to-end project management services ensuring timely delivery and quality outcomes',
      icon: Target,
      features: ['Project Planning', 'Resource Management', 'Risk Assessment', 'Progress Monitoring']
    },
    {
      title: 'Technical Consultation',
      description: 'Expert technical advisory services across all engineering disciplines',
      icon: Users,
      features: ['Design Review', 'Technical Analysis', 'Code Compliance', 'Performance Optimization']
    },
    {
      title: 'Feasibility Studies',
      description: 'Comprehensive project viability assessment and investment analysis',
      icon: BarChart3,
      features: ['Market Analysis', 'Financial Modeling', 'Risk Assessment', 'Implementation Strategy']
    },
    {
      title: 'Maintenance Services',
      description: 'Ongoing maintenance and support services for completed projects',
      icon: FileText,
      features: ['Preventive Maintenance', 'Performance Monitoring', 'System Upgrades', 'Technical Support']
    }
  ];

  const expertise = [
    'Multi-disciplinary Project Coordination',
    'Construction Management & Supervision',
    'Quality Assurance & Control',
    'Regulatory Compliance & Permitting',
    'Value Engineering & Cost Optimization',
    'Sustainability & Environmental Compliance'
  ];

  const projectTypes = [
    'Commercial & Residential Buildings',
    'Industrial Facilities',
    'Infrastructure Projects',
    'Healthcare Facilities',
    'Educational Institutions',
    'Government Buildings'
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                <Users size={40} className="text-white" />
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
              Consultancy Services
            </h1>
            <p className="text-xl text-white/90 mb-8 leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Expert consultation and project management services across all engineering disciplines
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <Button 
                size="lg" 
                variant="secondary" 
                className="px-8 py-4 hover:scale-105 transition-transform"
                onClick={() => {
                  if (profile?.id) {
                    navigate('/portal/client/consultancy');
                  } else {
                    toast({ title: 'Authentication required', description: 'you must be loggin to get consulting', variant: 'destructive' });
                  }
                }}
              >
                Start Consulting
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 py-4 text-white border-white hover:bg-white hover:text-indigo-600 hover:scale-105 transition-all"
                onClick={() => navigate('/projects')}
              >
                View Case Studies
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Consultancy <span className="text-primary">Services</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Comprehensive consultation and project management across all engineering disciplines
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <Card 
                key={index}
                className="group hover:shadow-corporate transition-all duration-300 border-card-border hover:border-primary/20 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <service.icon size={24} className="text-white" />
                    </div>
                    <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {service.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {service.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center text-sm text-muted-foreground">
                        <CheckCircle size={16} className="text-success mr-2" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Expertise & Project Types */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Expertise */}
            <div>
              <h3 className="text-3xl font-bold text-foreground mb-6">
                <Award className="inline mr-3 text-primary" size={32} />
                Our Expertise
              </h3>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Our multidisciplinary team brings decades of experience in delivering successful engineering and construction projects across various sectors.
              </p>
              <div className="space-y-4">
                {expertise.map((item, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                      <CheckCircle size={16} className="text-success" />
                    </Badge>
                    <span className="text-foreground font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Types */}
            <div>
              <h3 className="text-3xl font-bold text-foreground mb-6">
                <Target className="inline mr-3 text-primary" size={32} />
                Project Types
              </h3>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                We provide consultancy services for a wide range of project types, ensuring specialized expertise for each sector.
              </p>
              <div className="space-y-4">
                {projectTypes.map((type, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-foreground">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <Users size={48} className="mx-auto text-accent mb-6" />
            <h2 className="text-4xl font-bold text-primary-foreground mb-6">
              Ready to Start Your Project?
            </h2>
            <p className="text-xl text-primary-foreground/90 mb-8 leading-relaxed">
              Our expert consultants are ready to help you achieve your project goals with innovative solutions and proven expertise.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary" 
                className="px-8 py-4 hover:scale-105 transition-transform"
                onClick={() => {
                  if (profile?.id) {
                    navigate('/portal/client/consultancy');
                  } else {
                    toast({ title: 'Authentication required', description: 'you must be loggin to get consulting', variant: 'destructive' });
                  }
                }}
              >
                Start Consulting
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 py-4 text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary hover:scale-105 transition-all"
                onClick={() => window.location.href = '/contact'}
              >
                Request Proposal
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Consultancy;