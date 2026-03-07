import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Square, Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DebateMode, DebateParams } from '@/hooks/useDebateSession';

interface Props {
  params: DebateParams;
  onChange: (p: DebateParams) => void;
  running: boolean;
  sessionActive: boolean;
  awaitingInput: boolean;
  isDone: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
}

const ChatInputBar = ({ params, onChange, running, sessionActive, awaitingInput, isDone, onSend, onStop }: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [chatInput, setChatInput] = useState('');

  // The input value depends on context
  const inputValue = sessionActive ? chatInput : params.topic;
  const setInputValue = (val: string) => {
    if (sessionActive) {
      setChatInput(val);
    } else {
      onChange({ ...params, topic: val });
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const msg = inputValue.trim();
    if (!msg || running) return;
    onSend(msg);
    if (sessionActive) setChatInput('');
  };

  const canSend = inputValue.trim().length > 0 && !running;
  const placeholder = sessionActive
    ? awaitingInput || isDone
      ? 'Send a follow-up message… (Enter to send)'
      : 'Waiting for agents to finish…'
    : 'What should the agents discuss? (Enter to start)';

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2">
          {!sessionActive && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0 mb-0.5" title="Session settings">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 space-y-3" align="start" side="top">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Mode</label>
                  <Select
                    value={params.mode}
                    onValueChange={v => onChange({ ...params, mode: v as DebateMode })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debate">Debate</SelectItem>
                      <SelectItem value="collaborate">Collaborate</SelectItem>
                      <SelectItem value="compare">Compare</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Rounds</label>
                  <Select
                    value={String(params.rounds)}
                    onValueChange={v => onChange({ ...params, rounds: Number(v) })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} round{n > 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={running && !awaitingInput && !isDone}
              rows={1}
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]"
              style={{ minHeight: '44px', maxHeight: '160px' }}
            />
          </div>

          {running ? (
            <Button variant="destructive" size="icon" onClick={onStop} className="flex-shrink-0 mb-0.5" title="Stop">
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className="flex-shrink-0 mb-0.5"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>

        {running && (
          <p className="text-xs text-muted-foreground animate-pulse mt-2 text-center">
            Agents are discussing…
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatInputBar;
