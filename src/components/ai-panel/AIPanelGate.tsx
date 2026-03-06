import { Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';

const AIPanelGate = () => (
  <div className="flex items-center justify-center py-24">
    <Card className="p-12 text-center max-w-md">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
        <Lock className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">Team Access Only</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        The AI Panel is available to internal team members only.
        If you believe you should have access, contact the admin.
      </p>
    </Card>
  </div>
);

export default AIPanelGate;
