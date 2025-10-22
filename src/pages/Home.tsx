import HeroSection from '@/components/HeroSection';
import DepartmentsSection from '@/components/DepartmentsSection';
import StatsSection from '@/components/StatsSection';

const Home = () => {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <StatsSection />
      <DepartmentsSection />
    </div>
  );
};

export default Home;