import { TestTube, Shield, Award, CheckCircle, BarChart3, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const MaterialTesting = () => {
  const services = [
    {
      title: 'Concrete Testing',
      description: 'Comprehensive concrete strength and durability testing according to ES EN standards',
      icon: TestTube,
      features: ['Compressive Strength', 'Slump Test', 'Durability Analysis', 'Mix Design Verification']
    },
    {
      title: 'Steel Testing',
      description: 'Reinforcement steel and structural steel quality verification and certification',
      icon: Shield,
      features: ['Tensile Strength', 'Bend Test', 'Chemical Analysis', 'Weldability Test']
    },
    {
      title: 'Soil Analysis',
      description: 'Geotechnical soil investigation and bearing capacity analysis',
      icon: BarChart3,
      features: ['Bearing Capacity', 'Density Test', 'Moisture Content', 'Particle Size Analysis']
    },
    {
      title: 'Quality Assurance',
      description: 'Construction materials compliance verification and certification services',
      icon: Award,
      features: ['Material Certification', 'Compliance Reports', 'Quality Control', 'Standard Verification']
    }
  ];

  const certifications = [
    'ISO 17025:2017 Laboratory Accreditation',
    'Ethiopian Standards Agency Certification',
    'International Testing Standards Compliance',
    'Quality Management System ISO 9001:2015'
  ];

  const testingEquipment = [
    'Universal Testing Machine (UTM)',
    'Concrete Compression Testing Machine',
    'CBR Testing Equipment',
    'Aggregate Testing Apparatus',
    'Chemical Analysis Laboratory',
    'Non-Destructive Testing Equipment'
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-red-500 via-red-600 to-red-700 py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                <TestTube size={40} className="text-white" />
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
              Material Testing & Inspection
            </h1>
            <p className="text-xl text-white/90 mb-8 leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Ensuring construction quality through comprehensive material testing, inspection, and certification services
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <Button 
                size="lg" 
                variant="secondary" 
                className="px-8 py-4 hover:scale-105 transition-transform"
                onClick={() => window.location.href = '/contact'}
              >
                Request Testing Service
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 py-4 text-white border-white hover:bg-white hover:text-red-600 hover:scale-105 transition-all"
                onClick={() => window.location.href = '/projects'}
              >
                View Certifications
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
              Testing <span className="text-primary">Services</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Comprehensive material testing and quality assurance services for construction projects
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
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
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

      {/* Certifications & Equipment */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Certifications */}
            <div>
              <h3 className="text-3xl font-bold text-foreground mb-6">
                <Award className="inline mr-3 text-primary" size={32} />
                Certifications & Standards
              </h3>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Our laboratory maintains the highest standards of quality and accuracy through international certifications and compliance.
              </p>
              <div className="space-y-4">
                {certifications.map((cert, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                      <CheckCircle size={16} className="text-success" />
                    </Badge>
                    <span className="text-foreground font-medium">{cert}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div>
              <h3 className="text-3xl font-bold text-foreground mb-6">
                <BarChart3 className="inline mr-3 text-primary" size={32} />
                Testing Equipment
              </h3>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                State-of-the-art testing equipment ensures accurate and reliable results for all material testing requirements.
              </p>
              <div className="space-y-4">
                {testingEquipment.map((equipment, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-foreground">{equipment}</span>
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
            <FileText size={48} className="mx-auto text-accent mb-6" />
            <h2 className="text-4xl font-bold text-primary-foreground mb-6">
              Need Material Testing Services?
            </h2>
            <p className="text-xl text-primary-foreground/90 mb-8 leading-relaxed">
              Contact our expert team for comprehensive material testing and quality assurance services for your construction project.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary" 
                className="px-8 py-4 hover:scale-105 transition-transform"
                onClick={() => window.location.href = '/contact'}
              >
                Request Quote
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 py-4 text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary hover:scale-105 transition-all"
                onClick={() => window.location.href = '/contact'}
              >
                Schedule Visit
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MaterialTesting;