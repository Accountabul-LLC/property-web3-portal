import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const OWNER = 'JibreelMuhammad';
const REPO = 'property-web3-portal';

export interface TreeFile {
  path: string;
  size: number;
  sha: string;
}

export interface FileContent {
  path: string;
  content: string;
  sha: string;
  size: number;
}

export function useGitHubAgent() {
  const [treeLoading, setTreeLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: fnError } = await supabase.functions.invoke('github-agent', { body });
    if (fnError) throw new Error(fnError.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const getTree = useCallback(async (branch = 'main'): Promise<TreeFile[]> => {
    setTreeLoading(true);
    setError(null);
    try {
      const data = await invoke({ action: 'get_tree', owner: OWNER, repo: REPO, branch });
      return data.files as TreeFile[];
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setTreeLoading(false);
    }
  }, [invoke]);

  const getFile = useCallback(async (path: string, branch = 'main'): Promise<FileContent | null> => {
    setFileLoading(true);
    setError(null);
    try {
      const data = await invoke({ action: 'get_file', owner: OWNER, repo: REPO, path, branch });
      return data as FileContent;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setFileLoading(false);
    }
  }, [invoke]);

  return { getTree, getFile, treeLoading, fileLoading, error };
}
