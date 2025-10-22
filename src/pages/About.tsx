import { Target, Eye, Award, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import aboutHeroBg from '@/assets/about-hero-bg.jpg';

const About = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section with Background Image */}
      <section 
        className="relative py-32 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${aboutHeroBg})` }}
      >
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
              About <span className="text-accent">GCAE</span>
            </h1>
            <p className="text-xl text-white/90 leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              GUBALAFTO Consulting Architects and Engineers PLC, a proud member of MIDROC Investment Group, 
              has been delivering excellence in construction and IT consultancy since July 2018.
            </p>
          </div>
        </div>
      </section>

      <div className="py-20">
        <div className="container mx-auto px-4">
          {/* Vision & Mission Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <Card className="shadow-card border-card-border hover:shadow-corporate transition-all duration-300 group">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Eye size={32} className="text-primary-foreground" />
                </div>
                <CardTitle className="text-2xl font-bold text-primary">Our Vision</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-lg leading-relaxed">
                  To be the leading construction and IT consultancy firm in East Africa by 2025 E.C, 
                  recognized for our innovation, quality, and commitment to excellence.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-card border-card-border hover:shadow-corporate transition-all duration-300 group">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-accent rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Target size={32} className="text-accent-foreground" />
                </div>
                <CardTitle className="text-2xl font-bold text-primary">Our Mission</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-lg leading-relaxed">
                  To deliver quality architectural, engineering, ICT, and consultancy services with 
                  competent professionals while ensuring data security and customer satisfaction.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Values Section */}
          <div className="bg-secondary rounded-2xl p-8 mb-16 animate-fade-in">
            <h2 className="text-3xl font-bold text-center text-foreground mb-8">Our Core Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {[
                'Excellence',
                'Innovation', 
                'Client Satisfaction',
                'Teamwork',
                'Professionalism'
              ].map((value, index) => (
                <div key={value} className="text-center group animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <span className="text-primary-foreground font-bold text-xl">{value[0]}</span>
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{value}</h3>
                </div>
              ))}
            </div>
          </div>

          {/* Quality Policy */}
          <Card className="shadow-card border-card-border mb-16 hover:shadow-corporate transition-all duration-300 animate-fade-in">
            <CardHeader>
              <div className="w-16 h-16 bg-success rounded-xl flex items-center justify-center mb-4">
                <Award size={32} className="text-success-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold text-primary">ISO 9001:2015 Quality Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-lg leading-relaxed mb-4">
                GCAE is committed to maintaining the highest standards of quality management, 
                ensuring timely project delivery while prioritizing employee well-being and 
                continuous improvement in all our services.
              </CardDescription>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-secondary p-4 rounded-lg hover:bg-secondary/80 transition-colors">
                  <h4 className="font-semibold text-foreground mb-2">Quality Assurance</h4>
                  <p className="text-muted-foreground text-sm">Rigorous quality control processes</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg hover:bg-secondary/80 transition-colors">
                  <h4 className="font-semibold text-foreground mb-2">Timely Delivery</h4>
                  <p className="text-muted-foreground text-sm">On-time project completion</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg hover:bg-secondary/80 transition-colors">
                  <h4 className="font-semibold text-foreground mb-2">Employee Well-being</h4>
                  <p className="text-muted-foreground text-sm">Safe and supportive work environment</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Info */}
          <div className="text-center bg-primary text-primary-foreground rounded-2xl p-8 animate-fade-in">
            <Users size={48} className="mx-auto mb-6 text-accent" />
            <h2 className="text-3xl font-bold mb-4">Join Our Team</h2>
            <p className="text-xl text-primary-foreground/90 mb-6 max-w-2xl mx-auto">
              We're always looking for talented professionals to join our growing team of 
              architects, engineers, and ICT specialists.
            </p>
            <Link 
              to="/careers" 
              className="inline-flex items-center bg-accent text-accent-foreground px-6 py-3 rounded-lg font-semibold hover:bg-accent/90 transition-colors hover:scale-105 duration-300"
            >
              View Open Positions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;