import { ArrowRight, Building2, Cpu, Wrench, TestTube, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import heroImage from '@/assets/hero-bg.jpg';

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-primary overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img 
          src={heroImage} 
          alt="GCAE Engineering Excellence" 
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-hero opacity-90"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center text-primary-foreground">
        <div className="max-w-4xl mx-auto animate-fade-in">
          {/* Company Badge */}
          <div className="inline-flex items-center bg-accent/20 backdrop-blur-sm rounded-full px-6 py-2 mb-8">
            <span className="text-accent font-semibold text-sm">A MIDROC Investment Group Company</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            GUBALAFTO
            <span className="block text-accent">Consulting</span>
            <span className="block text-3xl md:text-4xl font-normal opacity-90">
              Architects & Engineers PLC
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl mb-8 text-primary-foreground/90 max-w-3xl mx-auto leading-relaxed">
            Leading construction and IT consultancy in East Africa, delivering excellence 
            in architectural, engineering, and ICT solutions since 2018.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-4" asChild>
              <Link to="/projects">
                View Our Projects <ArrowRight className="ml-2" size={20} />
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-4 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              asChild
            >
              <Link to="/contact">Get Consultation</Link>
            </Button>
          </div>

          {/* Service Icons Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
            {[
              { icon: Building2, label: 'Architecture' },
              { icon: Wrench, label: 'Engineering' },
              { icon: Cpu, label: 'ICT Solutions' },
              { icon: TestTube, label: 'Material Testing' },
            ].map((service, index) => (
              <div 
                key={service.label}
                className="flex flex-col items-center p-4 rounded-lg bg-primary-foreground/10 backdrop-blur-sm hover:bg-primary-foreground/20 transition-all duration-300 animate-scale-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <service.icon size={32} className="text-accent mb-2" />
                <span className="text-sm font-medium">{service.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-float">
        <div className="w-6 h-10 border-2 border-primary-foreground/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-primary-foreground/50 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;