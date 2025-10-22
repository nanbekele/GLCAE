import { Building2, Wrench, Zap, Cpu, TestTube, Users, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const Departments = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const departments = [
    {
      id: 'architecture',
      title: 'Architecture & Civil Engineering',
      description: 'Comprehensive architectural design and civil engineering solutions for modern construction projects, from conceptual design to project completion.',
      icon: Building2,
      services: [
        'Architectural Design & Planning',
        'Structural Design & Analysis', 
        'Urban Planning & Development',
        'Construction Management',
        'Building Information Modeling (BIM)',
        'Site Supervision & Quality Control'
      ],
      image: '/api/placeholder/600/400',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'mechanical',
      title: 'Mechanical Engineering',
      description: 'Advanced mechanical systems design and HVAC solutions for optimal building performance and energy efficiency.',
      icon: Wrench,
      services: [
        'HVAC System Design',
        'Plumbing & Sanitary Systems',
        'Fire Protection Systems',
        'Energy Management Systems',
        'Mechanical Equipment Selection',
        'Maintenance Planning'
      ],
      image: '/api/placeholder/600/400',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'electrical',
      title: 'Electrical Engineering',
      description: 'Innovative electrical systems and power distribution solutions for modern infrastructure and smart buildings.',
      icon: Zap,
      services: [
        'Power System Design',
        'Lighting Design & Control',
        'Emergency Power Systems',
        'Building Automation',
        'Electrical Safety Systems',
        'Energy Efficiency Solutions'
      ],
      image: '/api/placeholder/600/400',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      id: 'ict',
      title: 'ICT Solutions',
      description: 'Cutting-edge information and communication technology services for digital transformation and smart infrastructure.',
      icon: Cpu,
      services: [
        'ERP System Implementation',
        'Network Design & Setup',
        'CCTV & Security Systems',
        'Data Center Solutions',
        'Software Development',
        'IT Consulting & Support'
      ],
      image: '/api/placeholder/600/400',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'testing',
      title: 'Material Testing & Inspection',
      description: 'Comprehensive material testing and quality assurance services ensuring compliance with international standards.',
      icon: TestTube,
      services: [
        'Concrete Testing & Analysis',
        'Soil Investigation & Testing',
        'Steel & Metal Testing',
        'Construction Material Quality Control',
        'Non-Destructive Testing',
        'Laboratory Services'
      ],
      image: '/api/placeholder/600/400',
      color: 'from-red-500 to-red-600'
    },
    {
      id: 'consultancy',
      title: 'Consultancy & Project Management',
      description: 'Expert consultation and comprehensive project management services across all engineering disciplines.',
      icon: Users,
      services: [
        'Project Management & Planning',
        'Technical Consultation',
        'Feasibility Studies',
        'Construction Supervision',
        'Maintenance Services',
        'Training & Capacity Building'
      ],
      image: '/api/placeholder/600/400',
      color: 'from-indigo-500 to-indigo-600'
    }
  ];

  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            Our <span className="text-primary">Departments</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Six specialized departments working in synergy to deliver comprehensive 
            engineering and architectural solutions for complex projects across Ethiopia and East Africa.
          </p>
        </div>

        {/* Departments Grid */}
        <div className="space-y-12">
          {departments.map((dept, index) => (
            <Card 
              key={dept.id}
              className="overflow-hidden shadow-corporate border-card-border animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`grid grid-cols-1 lg:grid-cols-2 ${index % 2 === 1 ? 'lg:grid-cols-2' : ''}`}>
                {/* Content */}
                <div className={`order-2 ${index % 2 === 1 ? 'lg:order-1' : 'lg:order-2'}`}>
                  <CardHeader className="p-8">
                    <div className={`w-20 h-20 rounded-xl bg-gradient-to-br ${dept.color} flex items-center justify-center mb-6`}>
                      <dept.icon size={40} className="text-white" />
                    </div>
                    <CardTitle className="text-3xl font-bold text-foreground mb-4">
                      {dept.title}
                    </CardTitle>
                    <CardDescription className="text-lg text-muted-foreground leading-relaxed">
                      {dept.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-8 pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                      {dept.services.map((service, serviceIndex) => (
                        <div 
                          key={serviceIndex}
                          className="flex items-center text-sm text-muted-foreground"
                        >
                          <div className="w-2 h-2 bg-primary rounded-full mr-3 flex-shrink-0"></div>
                          {service}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button 
                        className="flex-1"
                        asChild
                      >
                        <Link to={`/departments/${dept.id}`}>
                          Learn More <ArrowRight size={16} className="ml-2" />
                        </Link>
                      </Button>
                      <Button 
                        variant="outline"
                        className="flex-1"
                        asChild
                      >
                        <Link to="/contact">
                          Request Quote
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </div>

                {/* Image */}
                <div className={`order-1 ${index % 2 === 1 ? 'lg:order-2' : 'lg:order-1'}`}>
                  <div className="h-64 lg:h-full bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <dept.icon size={64} className="text-primary mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-foreground">
                        {dept.title}
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center bg-primary text-primary-foreground rounded-2xl p-12">
          <h2 className="text-4xl font-bold mb-6">Ready to Start Your Project?</h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Our multidisciplinary team is ready to tackle your most challenging projects. 
            Get in touch for a consultation today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary" 
              className="px-8 py-4"
              onClick={() => {
                if (profile?.id) {
                  navigate('/portal/client/consultancy');
                } else {
                  toast({ title: 'Authentication required', description: 'you must be loggin to get consulting', variant: 'destructive' });
                }
              }}
            >
              Get Consultation
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="px-8 py-4 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              asChild
            >
              <Link to="/projects">
                View Our Work
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Departments;