import { Award, Calendar, Users, Building } from 'lucide-react';

const StatsSection = () => {
  const stats = [
    {
      icon: Calendar,
      value: '6+',
      label: 'Years of Excellence',
      description: 'Since July 2018'
    },
    {
      icon: Building,
      value: '100+',
      label: 'Projects Completed',
      description: 'Across all departments'
    },
    {
      icon: Users,
      value: '50+',
      label: 'Expert Professionals',
      description: 'Certified engineers & architects'
    },
    {
      icon: Award,
      value: 'ISO',
      label: '9001:2015 Certified',
      description: 'Quality management system'
    }
  ];

  return (
    <section className="py-20 bg-primary">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-primary-foreground mb-4">
            Excellence in <span className="text-accent">Numbers</span>
          </h2>
          <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
            Our commitment to quality and innovation drives measurable results
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className="text-center group animate-fade-in"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <div className="w-20 h-20 mx-auto mb-6 bg-accent/20 rounded-full flex items-center justify-center group-hover:bg-accent/30 transition-colors duration-300">
                <stat.icon size={40} className="text-accent" />
              </div>
              <div className="text-4xl font-bold text-primary-foreground mb-2">
                {stat.value}
              </div>
              <div className="text-xl font-semibold text-accent mb-2">
                {stat.label}
              </div>
              <div className="text-primary-foreground/70">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;