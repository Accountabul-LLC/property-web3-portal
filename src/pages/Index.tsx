import React from 'react';
import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import ValuePropositionSection from '@/components/ValuePropositionSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import NewsletterSection from '@/components/NewsletterSection';
import Footer from '@/components/Footer';
import MembershipModal from '@/components/MembershipModal';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const [isMembershipModalOpen, setIsMembershipModalOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/tokenize');
  };

  const handleMembershipPurchase = () => {
    setIsMembershipModalOpen(false);
    navigate('/tokenize');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <HeroSection onGetStarted={handleGetStarted} />
      <HowItWorksSection />
      <ValuePropositionSection />
      <TestimonialsSection />
      <NewsletterSection />
      <Footer />
      
      <MembershipModal
        isOpen={isMembershipModalOpen}
        onClose={() => setIsMembershipModalOpen(false)}
        onPurchase={handleMembershipPurchase}
      />
    </div>
  );
};

export default Index;
