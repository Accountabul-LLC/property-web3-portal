import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { isSaveEligiblePropertyStatus, useSavedPropertyIds, useToggleSavedProperty } from '@/hooks/useSavedProperties';

interface PropertySaveButtonProps {
  propertyId: string;
  propertyStatus?: string | null;
  className?: string;
  showLabel?: boolean;
}

const PropertySaveButton: React.FC<PropertySaveButtonProps> = ({
  propertyId,
  propertyStatus,
  className = '',
  showLabel = false,
}) => {
  const autoClearRef = React.useRef(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeAddress, openConnectModal } = useActiveWallet();
  const { data: savedIds = [] } = useSavedPropertyIds();
  const saveToggle = useToggleSavedProperty();

  const isSaved = savedIds.includes(propertyId);
  const isEligible = isSaveEligiblePropertyStatus(propertyStatus);

  React.useEffect(() => {
    if (isEligible) {
      autoClearRef.current = false;
      return;
    }

    if (!isSaved || saveToggle.isPending || autoClearRef.current) return;

    autoClearRef.current = true;
    void saveToggle.mutateAsync(propertyId).catch(() => {
      autoClearRef.current = false;
    });
  }, [isEligible, isSaved, propertyId, saveToggle]);

  const handleClick = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!activeAddress) {
      openConnectModal();
      return;
    }

    try {
      await saveToggle.mutateAsync(propertyId);
    } catch {
      // toast is handled by the mutation
    }
  };

  return (
    <Button
      type="button"
      variant={isSaved ? 'default' : 'outline'}
      size="sm"
      onClick={handleClick}
      disabled={saveToggle.isPending}
      className={`gap-2 ${isSaved ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''} ${className}`}
      title={isSaved ? 'Remove from saved properties' : 'Save property'}
    >
      <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
      {showLabel ? (isSaved ? 'Saved' : 'Save') : null}
    </Button>
  );
};

export default PropertySaveButton;
