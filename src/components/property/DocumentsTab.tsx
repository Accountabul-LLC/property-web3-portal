import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { FileText, Download, Eye, Calendar, Loader2 } from 'lucide-react';
import { usePropertyDocuments } from '@/hooks/usePropertyData';

interface DocumentsTabProps {
  documents?: any[]; // kept for backward compat
  propertyId?: string;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ propertyId }) => {
  const { data: docs = [], isLoading } = usePropertyDocuments(propertyId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Property Documents</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No documents uploaded yet for this property.
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{doc.name}</h4>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>{doc.file_type}</span>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <Eye className="w-4 h-4 mr-1" /> View
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={doc.file_url} download>
                        <Download className="w-4 h-4 mr-1" /> Download
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium mb-2">Document Access</h4>
              <p className="text-sm text-muted-foreground mb-4">
                All documents are stored securely and are accessible to token holders.
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Legal documents are updated automatically when changes occur</p>
                <p>• Financial reports are updated quarterly</p>
                <p>• All documents are backed up and encrypted</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentsTab;
