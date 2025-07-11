import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Star, Zap } from 'lucide-react';

interface MembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: () => void;
}

const MembershipModal = ({ isOpen, onClose, onPurchase }: MembershipModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Accountabul Membership Required
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <p className="text-center text-muted-foreground">
            You must be an Accountabul Member to tokenize property or invest in real estate.
          </p>

          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm">Secure blockchain-powered transactions</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
              <Star className="w-5 h-5 text-primary" />
              <span className="text-sm">Access to exclusive tokenization features</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-sm">Priority support and marketplace access</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={onPurchase}
              className="w-full" 
              variant="hero" 
              size="lg"
            >
              Buy Membership Now
            </Button>
            <Button 
              onClick={onClose}
              variant="outline" 
              className="w-full"
            >
              Learn More
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MembershipModal;