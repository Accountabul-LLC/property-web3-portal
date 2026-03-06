import { useEffect, useState, useMemo, useCallback } from 'react';
import { useGitHubAgent, type TreeFile, type FileContent } from '@/hooks/useGitHubAgent';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, File, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  size?: number;
}

function buildTree(files: TreeFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const f of files) {
    const parts = f.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const existing = current.find((n) => n.name === name);
      if (existing) {
        current = existing.children;
      } else {
        const node: TreeNode = {
          name,
          path: parts.slice(0, i + 1).join('/'),
          isDir: !isLast,
          children: [],
          size: isLast ? f.size : undefined,
        };
        current.push(node);
        current = node.children;
      }
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(root);
  return root;
}

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isSelected = selectedPath === node.path;

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex items-center gap-1 w-full text-left px-2 py-1 text-sm hover:bg-accent/50 rounded-sm',
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          {open ? <FolderOpen className="w-4 h-4 text-primary" /> : <Folder className="w-4 h-4 text-primary" />}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children.map((child) => (
          <TreeItem key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={cn(
        'flex items-center gap-1 w-full text-left px-2 py-1 text-sm rounded-sm',
        isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent/50 text-foreground',
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export default function CodeBrowser() {
  const { getTree, getFile, treeLoading, fileLoading, error } = useGitHubAgent();
  const [files, setFiles] = useState<TreeFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);

  useEffect(() => {
    getTree().then(setFiles);
  }, [getTree]);

  const tree = useMemo(() => buildTree(files), [files]);

  const handleSelect = useCallback(async (path: string) => {
    setSelectedPath(path);
    const content = await getFile(path);
    setFileContent(content);
  }, [getFile]);

  if (treeLoading && files.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading repository…</span>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] border rounded-lg overflow-hidden bg-background">
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">{error}</div>
      )}
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={30} minSize={20}>
          <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Files ({files.length})
          </div>
          <ScrollArea className="h-[calc(100%-2.5rem)]">
            <div className="py-1">
              {tree.map((node) => (
                <TreeItem key={node.path} node={node} depth={0} selectedPath={selectedPath} onSelect={handleSelect} />
              ))}
            </div>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70} minSize={40}>
          {fileLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : fileContent ? (
            <div className="flex flex-col h-full">
              <div className="border-b px-4 py-2 flex items-center gap-2 bg-muted/30">
                <File className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-mono text-foreground">{fileContent.path}</span>
                <span className="text-xs text-muted-foreground ml-auto">{(fileContent.size / 1024).toFixed(1)} KB</span>
              </div>
              <ScrollArea className="flex-1">
                <pre className="p-4 text-sm font-mono leading-relaxed text-foreground whitespace-pre overflow-x-auto">
                  <code>{fileContent.content}</code>
                </pre>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a file to view its contents
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
