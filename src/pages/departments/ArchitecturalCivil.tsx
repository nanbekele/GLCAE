import { Building2, ArrowLeft, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ArchitecturalCivil = () => {
  const services = [
    {
      title: "Design Services",
      items: [
        "Conduct field trips to observe and inspect the site and existing structures",
        "Prepare conceptual/preliminary designs and budgetary estimates and submit to the client for approval/decision",
        "Prepare final detailed architectural, structural, Electrical and sanitary design drawings, specifications and bill of quantities"
      ]
    },
    {
      title: "Construction Supervision Services",
      items: [
        "Periodic visits to the construction site",
        "Interpretation of plans and specifications",
        "Processing & certification of contractor's payment requests",
        "Preparation of amendments to the contracts",
        "Preparation of 'as-built' drawings",
        "Resident Supervision: A representative or a resident engineer is assigned to the site permanently from commencement until completion of construction"
      ]
    },
    {
      title: "Contract Administration Services",
      items: [
        "Tendering",
        "Evaluation of offers",
        "Contract negotiations",
        "Awarding of contract",
        "Processing progress claims",
        "Processing variations",
        "Issuance of provisional acceptance certificates",
        "Monitoring defects liability period",
        "Preparation of final statement of accounts and closure report"
      ]
    },
    {
      title: "Review of Existing Products Services",
      items: [
        "Architecture, Structure, Electrical, Sanitary, Drafting and Modelling, Cost Engineering and Supervision (11x1808=19888 Man-hours/year)"
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
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center mr-6">
              <Building2 size={40} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                Architectural & Civil Engineering Design Unit
              </h1>
              <p className="text-xl text-muted-foreground">
                Comprehensive architectural design and civil engineering solutions for modern construction projects
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
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {service.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start">
                      <CheckCircle size={20} className="text-primary mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Start Your Project?</h2>
            <p className="text-xl text-primary-foreground/90 mb-6 max-w-2xl mx-auto">
              Our experienced architectural and civil engineering team is ready to bring your vision to life with innovative design solutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="px-8" asChild>
                <Link to="/contact">Request Consultation</Link>
              </Button>
              <Button size="lg" variant="outline" className="px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/projects">View Our Projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ArchitecturalCivil;