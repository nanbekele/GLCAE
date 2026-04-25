import { Award, Calendar, Users, Building } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const StatsSection = () => {
  const yearsOfExcellence = useMemo(() => {
    const start = new Date('2018-07-01T00:00:00Z');
    const now = new Date();
    const diffYears = Math.max(0, now.getUTCFullYear() - start.getUTCFullYear() - (now < new Date(Date.UTC(now.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) ? 1 : 0));
    const display = Math.max(1, diffYears);
    return `${display}+`;
  }, []);

  const [projectsCompleted, setProjectsCompleted] = useState<string>('100+');
  const [expertProfessionals, setExpertProfessionals] = useState<string>('50+');

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      try {
        const [{ count: projectsCount, error: projectsError }, { count: staffCount, error: staffError }] = await Promise.all([
          supabase.from('projects').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
        ]);

        if (!cancelled && !projectsError && typeof projectsCount === 'number') {
          setProjectsCompleted(`${projectsCount}+`);
        }

        if (!cancelled && !staffError && typeof staffCount === 'number') {
          setExpertProfessionals(`${staffCount}+`);
        }
      } catch {
        // Keep fallback values
      }
    };

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    {
      icon: Calendar,
      value: yearsOfExcellence,
      label: 'Years of Excellence',
      description: 'Since July 2018'
    },
    {
      icon: Building,
      value: projectsCompleted,
      label: 'Projects Completed',
      description: 'Across all departments'
    },
    {
      icon: Users,
      value: expertProfessionals,
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