import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { FileText, Download, Eye, Calendar } from 'lucide-react';

interface Document {
  name: string;
  type: string;
  url: string;
}

interface DocumentsTabProps {
  documents: Document[];
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ documents }) => {
  const documentCategories = {
    'Legal Documents': [
      { name: 'Property Deed', type: 'PDF', url: '#', uploadDate: '2024-01-15', size: '2.3 MB' },
      { name: 'LLC Formation Documents', type: 'PDF', url: '#', uploadDate: '2024-01-10', size: '1.8 MB' },
      { name: 'Operating Agreement', type: 'PDF', url: '#', uploadDate: '2024-01-10', size: '3.2 MB' },
    ],
    'Property Reports': [
      { name: 'Property Appraisal', type: 'PDF', url: '#', uploadDate: '2024-01-08', size: '4.1 MB' },
      { name: 'Home Inspection Report', type: 'PDF', url: '#', uploadDate: '2024-01-05', size: '6.7 MB' },
      { name: 'Environmental Assessment', type: 'PDF', url: '#', uploadDate: '2024-01-05', size: '2.9 MB' },
    ],
    'Financial Documents': [
      { name: 'Purchase Agreement', type: 'PDF', url: '#', uploadDate: '2024-01-12', size: '1.4 MB' },
      { name: 'Closing Statement', type: 'PDF', url: '#', uploadDate: '2024-01-15', size: '892 KB' },
      { name: 'Title Insurance Policy', type: 'PDF', url: '#', uploadDate: '2024-01-15', size: '1.1 MB' },
    ],
    'Rental Documents': [
      { name: 'Current Lease Agreement', type: 'PDF', url: '#', uploadDate: '2024-01-20', size: '756 KB' },
      { name: 'Rental History Report', type: 'PDF', url: '#', uploadDate: '2024-01-18', size: '1.3 MB' },
      { name: 'Property Management Agreement', type: 'PDF', url: '#', uploadDate: '2024-01-10', size: '982 KB' },
    ],
  };

  const handleDownload = (docName: string) => {
    // Placeholder for download functionality
    console.log(`Downloading ${docName}`);
  };

  const handleView = (docName: string) => {
    // Placeholder for view functionality
    console.log(`Viewing ${docName}`);
  };

  return (
    <div className="space-y-6">
      {/* Document Categories */}
      {Object.entries(documentCategories).map(([category, docs]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>{category}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {docs.map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{doc.name}</h4>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>{doc.type}</span>
                        <span>{doc.size}</span>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{doc.uploadDate}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(doc.name)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc.name)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Document Access Notice */}
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
                Some documents may require ownership verification to access.
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Legal documents are updated automatically when changes occur</p>
                <p>• Financial reports are updated quarterly</p>
                <p>• All documents are backed up and encrypted</p>
                <p>• Document history and version control available</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentsTab;