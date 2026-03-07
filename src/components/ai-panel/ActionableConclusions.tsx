import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';
import ActionItemsPreviewModal from './ActionItemsPreviewModal';
import type { DebateTurnData } from '@/hooks/useDebateSession';

interface Props {
  topic: string;
  turns: DebateTurnData[];
  sessionId?: string;
}

const ActionableConclusions = ({ topic, turns, sessionId }: Props) => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setModalOpen(true)} variant="outline" className="gap-2">
        <Lightbulb className="w-4 h-4" />
        Generate Action Items
      </Button>

      <ActionItemsPreviewModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
        }}
        topic={topic}
        turns={turns}
        sessionId={sessionId}
      />
    </>
  );
};

export default ActionableConclusions;
