import { Cpu, ArrowLeft, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ICT = () => {
  const services = [
    {
      title: "Software Development and Consultancy Services",
      items: [
        "ERP solutions - Providing ERP Consultancy, development and implementation service to different kind of businesses. ERP is to think about all the core business processes needed to run a company finance, HR, manufacturing, supply chain, services, and procurement. At its most basic level, ERP helps to efficiently manage all these processes in an integrated system."
      ]
    },
    {
      title: "Software and Website Development Services",
      items: [
        "Web & windows-based Applications Development",
        "Full Stack Development",
        "Ecommerce Solution Development",
        "CMS Websites",
        "API Integration",
        "Website Design and Development",
        "Mobile App Development and Design",
        "High-quality software at an economical cost"
      ]
    },
    {
      title: "Network and Data Center Design and Installation",
      items: [
        "Small to high enterprise level network and data center design and installation services",
        "Wired and wireless network, Internet, and wide area network access",
        "Designing and cabling infrastructure underlying data services",
        "Data center administration services",
        "State-of-the-art data center and backup facilities",
        "24/7 critical server availability throughout the year"
      ]
    },
    {
      title: "CCTV and Access Control Solutions",
      items: [
        "CCTV (Video Surveillance) design and installation services",
        "Crime Prevention and Security Cost Reduction",
        "Deterring Vandalism",
        "Camera Footage for Evidence",
        "Increase operational efficiencies for various industries",
        "Access control solution such as attendance control, turnstile and other biometric access control solutions"
      ]
    },
    {
      title: "GPS and Fleet Management Solutions",
      items: [
        "Installation of modern GPS device and fuel management solutions",
        "Fleet GPS tracking system monitoring every movement",
        "Gas usage, mileage, start/stops, and exact locations tracking",
        "Fuel theft prevention"
      ]
    },
    {
      title: "Maintenance Services",
      items: [
        "Software maintenance",
        "Network maintenance",
        "Computer and other office equipment maintenance",
        "Annual technical inspection of sales registration equipment"
      ]
    },
    {
      title: "Customer Support Service",
      items: [
        "Centralized point of contact for help with IT topics",
        "Computer and accessories maintenance support",
        "Office machinery maintenance support",
        "Cash Register (Sales point) machine maintenance support",
        "Annual hardware and office machinery maintenance support",
        "All types of software support"
      ]
    },
    {
      title: "Special Services",
      items: [
        "Data center services",
        "Information security services",
        "ERP support",
        "CCTV Camera design and installation support",
        "Consultancy Services",
        "Video conferencing facility installation services"
      ]
    }
  ];

  const memberships = [
    "Ethiopian Society of Electrical Engineers",
    "Ethiopian Mechanical Engineering Associations",
    "Ethiopian Consulting Engineers & Architects Associations",
    "Member of Addis Ababa Chamber of Commerce"
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
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center mr-6">
              <Cpu size={40} className="text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                Information and Communication Technology Unit
              </h1>
              <p className="text-xl text-muted-foreground">
                Cutting-edge information and communication technology services for digital transformation
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
                      <CheckCircle size={20} className="text-accent mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Memberships Section */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">Membership and Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {memberships.map((membership, index) => (
                <li key={index} className="flex items-center">
                  <CheckCircle size={20} className="text-accent mr-3 flex-shrink-0" />
                  <span className="text-muted-foreground">{membership}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <Card className="bg-accent text-accent-foreground">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Transform Your Business with ICT Solutions</h2>
            <p className="text-xl text-accent-foreground/90 mb-6 max-w-2xl mx-auto">
              From ERP systems to network infrastructure, our ICT experts help businesses leverage technology for growth and efficiency.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="px-8" asChild>
                <Link to="/contact">Request Consultation</Link>
              </Button>
              <Button size="lg" variant="outline" className="px-8 border-accent-foreground/30 text-accent-foreground hover:bg-accent-foreground/10" asChild>
                <Link to="/projects">View Our Projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ICT;