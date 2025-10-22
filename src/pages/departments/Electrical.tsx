import { Zap, ArrowLeft, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Electrical = () => {
  const services = [
    {
      title: "Design Services",
      description: "Based on the client's work order/request, prepare design and or revision, bill of quantity and submit to the client for approval/decision for the following systems:",
      items: [
        "Building power and lighting system",
        "Industrial power and lighting system",
        "Power and control circuit of commercial or industrial pump"
      ]
    },
    {
      title: "Installation, Supervision, and Consultancy Services",
      items: [
        "Machinery selection, layout design, installation, testing and commissioning support services for plant machinery and equipment",
        "Electrical maintenance, training and consultancy services",
        "Machinery and parts inspection and evaluation services",
        "Electrical system installation services",
        "Periodic visits to site and consultation service",
        "Security system, access control, CCTV monitoring system and alarms system support services"
      ]
    },
    {
      title: "Maintenance Support Services",
      items: [
        "Automation system troubleshooting and maintenance support",
        "Farm machinery maintenance support",
        "Irrigation system maintenance support",
        "Refrigeration system/Cold Room maintenance support",
        "Stand by generators maintenance service",
        "Industrial and commercial equipment maintenance support"
      ]
    },
    {
      title: "Generate Engineering Study with Proposal",
      items: [
        "Comprehensive electrical engineering studies and proposals for various industrial and commercial applications"
      ]
    }
  ];

  return (
    <div className="min-h-screen py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" className="mb-4" asChild>
            <Link to="/departments" className="flex items-center">
              <ArrowLeft size={16} className="mr-2" />
              Back to Departments
            </Link>
          </Button>
          
          <div className="flex items-center mb-6">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-warning to-warning-dark flex items-center justify-center mr-6">
              <Zap size={40} className="text-warning-foreground" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                Electrical Engineering Unit
              </h1>
              <p className="text-xl text-muted-foreground">
                Innovative electrical systems and power distribution solutions for modern infrastructure
              </p>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {services.map((service, index) => (
            <Card key={index} className="h-fit">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground">{service.title}</CardTitle>
                {service.description && (
                  <CardDescription className="text-base">{service.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {service.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start">
                      <CheckCircle size={20} className="text-warning mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <Card className="bg-warning text-warning-foreground">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Power Your Projects with Expert Electrical Solutions</h2>
            <p className="text-xl text-warning-foreground/90 mb-6 max-w-2xl mx-auto">
              From building power systems to security installations, our electrical engineering team ensures safe and efficient solutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="px-8" asChild>
                <Link to="/contact">Request Consultation</Link>
              </Button>
              <Button size="lg" variant="outline" className="px-8 border-warning-foreground/30 text-warning-foreground hover:bg-warning-foreground/10" asChild>
                <Link to="/projects">View Our Projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Electrical;