import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import TokenizeSection from '@/components/TokenizeSection';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';

const Tokenize = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <TokenizeSection />
      <Footer />
    </div>
  );
};

export default Tokenize;
