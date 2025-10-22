import { Building2, Wrench, Zap, Cpu, TestTube, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const DepartmentsSection = () => {
  const departments = [
    {
      id: 'architecture',
      title: 'Architecture & Civil',
      description: 'Comprehensive architectural design and civil engineering solutions for modern construction projects.',
      icon: Building2,
      services: ['Architectural Design', 'Structural Design', 'Urban Planning', 'Project Management'],
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'mechanical',
      title: 'Mechanical Engineering',
      description: 'Advanced mechanical systems design and HVAC solutions for optimal building performance.',
      icon: Wrench,
      services: ['HVAC Systems', 'Plumbing Design', 'Fire Protection', 'Energy Systems'],
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'electrical',
      title: 'Electrical Engineering',
      description: 'Innovative electrical systems and power distribution solutions for modern infrastructure.',
      icon: Zap,
      services: ['Power Systems', 'Lighting Design', 'Control Systems', 'Safety Systems'],
      color: 'from-yellow-500 to-orange-500'
    },
    {
      id: 'ict',
      title: 'ICT Solutions',
      description: 'Cutting-edge information and communication technology services for digital transformation.',
      icon: Cpu,
      services: ['ERP Systems', 'Network Solutions', 'CCTV & Security', 'Data Centers'],
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'testing',
      title: 'Material Testing',
      description: 'Comprehensive material testing and quality assurance services for construction projects.',
      icon: TestTube,
      services: ['Concrete Testing', 'Soil Analysis', 'Steel Testing', 'Quality Control'],
      color: 'from-red-500 to-red-600'
    },
    {
      id: 'consultancy',
      title: 'Consultancy',
      description: 'Expert consultation and project management services across all engineering disciplines.',
      icon: Users,
      services: ['Project Management', 'Technical Consultation', 'Feasibility Studies', 'Maintenance'],
      color: 'from-indigo-500 to-indigo-600'
    }
  ];

  return (
    <section className="py-20 bg-secondary">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Our <span className="text-primary">Departments</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Six specialized departments working together to deliver comprehensive 
            engineering and architectural solutions for complex projects.
          </p>
        </div>

        {/* Departments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {departments.map((dept, index) => (
            <Card 
              key={dept.id}
              className="group hover:shadow-corporate transition-all duration-300 border-card-border hover:border-primary/20 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader>
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${dept.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <dept.icon size={32} className="text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  {dept.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  {dept.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-6">
                  {dept.services.map((service, serviceIndex) => (
                    <div 
                      key={serviceIndex}
                      className="flex items-center text-sm text-muted-foreground"
                    >
                      <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                      {service}
                    </div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  asChild
                >
                  <Link to={`/departments/${dept.id}`}>
                    Learn More
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button size="lg" className="px-8 py-4" asChild>
            <Link to="/departments">
              View All Departments
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default DepartmentsSection;