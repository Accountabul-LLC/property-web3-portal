import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, MapPin, DollarSign, FileText, Shield, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { useTokenizeForm } from '@/hooks/useTokenizeForm';
import { useAuth } from '@/hooks/useAuth';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TokenizeSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    formData,
    handleInputChange,
    saveDraft,
    submitForTokenization,
    saving,
  } = useTokenizeForm();

  const [currentStep, setCurrentStep] = React.useState(1);
  const [uploadedFiles, setUploadedFiles] = React.useState<string[]>([]);

  const handleFileUpload = (fileType: string) => {
    setUploadedFiles(prev => [...prev, fileType]);
  };

  const handlePlaceSelect = async (placeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('places-details', {
        body: { placeId },
      });
      if (error) throw error;
      if (data) {
        if (data.streetNumber && data.route) {
          handleInputChange('propertyAddress', `${data.streetNumber} ${data.route}`);
        }
        if (data.city) handleInputChange('city', data.city);
        if (data.state) handleInputChange('state', data.state);
        if (data.zip) handleInputChange('zip', data.zip);
        if (data.country) handleInputChange('country', data.country);
      }
    } catch (err) {
      console.error('Place details error:', err);
      toast.error('Could not auto-fill address details');
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    const success = await submitForTokenization();
    if (success) {
      navigate('/');
    }
  };

  const handleSaveDraft = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    await saveDraft();
  };

  const steps = [
    { id: 1, title: 'Property Details', icon: MapPin },
    { id: 2, title: 'Financial Info', icon: DollarSign },
    { id: 3, title: 'Documentation', icon: FileText },
    { id: 4, title: 'Verification', icon: Shield },
  ];

  const requiredDocuments = [
    { name: 'Property Deed', uploaded: uploadedFiles.includes('deed'), required: true },
    { name: 'Recent Appraisal', uploaded: uploadedFiles.includes('appraisal'), required: true },
    { name: 'Property Photos', uploaded: uploadedFiles.includes('photos'), required: true },
    { name: 'Insurance Policy', uploaded: uploadedFiles.includes('insurance'), required: false },
    { name: 'Tax Records', uploaded: uploadedFiles.includes('tax'), required: false },
    { name: 'Floor Plans', uploaded: uploadedFiles.includes('floorplans'), required: false },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="address">Street Address *</Label>
              <div className="mt-2">
                <AddressAutocomplete
                  id="address"
                  value={formData.propertyAddress}
                  onChange={(value) => handleInputChange('propertyAddress', value)}
                  onPlaceSelect={handlePlaceSelect}
                  placeholder="Start typing an address..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="unit">Unit / Apt # (optional)</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                placeholder="Apt 4B, Unit 12, Suite 100..."
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="New York"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  placeholder="NY"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="zip">ZIP Code *</Label>
                <Input
                  id="zip"
                  value={formData.zip}
                  onChange={(e) => handleInputChange('zip', e.target.value)}
                  placeholder="10001"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  placeholder="US"
                  className="mt-2"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="propertyType">Property Type *</Label>
                <Select value={formData.propertyType} onValueChange={(value) => handleInputChange('propertyType', value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single-family">Single Family Home</SelectItem>
                    <SelectItem value="condo">Condominium</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="multi-family">Multi-Family</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="squareFootage">Square Footage *</Label>
                <Input
                  id="squareFootage"
                  value={formData.squareFootage}
                  onChange={(e) => handleInputChange('squareFootage', e.target.value)}
                  placeholder="2,500"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  value={formData.bedrooms}
                  onChange={(e) => handleInputChange('bedrooms', e.target.value)}
                  placeholder="3"
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  value={formData.bathrooms}
                  onChange={(e) => handleInputChange('bathrooms', e.target.value)}
                  placeholder="2.5"
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="yearBuilt">Year Built</Label>
                <Input
                  id="yearBuilt"
                  value={formData.yearBuilt}
                  onChange={(e) => handleInputChange('yearBuilt', e.target.value)}
                  placeholder="2010"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Property Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the property features, condition, and unique selling points..."
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="appraisalValue">Appraised Value *</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="appraisalValue"
                    value={formData.appraisalValue}
                    onChange={(e) => handleInputChange('appraisalValue', e.target.value)}
                    placeholder="500,000"
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="monthlyRent">Monthly Rental Income</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="monthlyRent"
                    value={formData.monthlyRent}
                    onChange={(e) => handleInputChange('monthlyRent', e.target.value)}
                    placeholder="3,500"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="propertyTax">Annual Property Tax</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="propertyTax"
                    value={formData.propertyTax}
                    onChange={(e) => handleInputChange('propertyTax', e.target.value)}
                    placeholder="12,000"
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="zoning">Zoning Classification</Label>
                <Input
                  id="zoning"
                  value={formData.zoning}
                  onChange={(e) => handleInputChange('zoning', e.target.value)}
                  placeholder="R-1 Residential"
                  className="mt-2"
                />
              </div>
            </div>

            <Card className="p-6 bg-muted/30">
              <h3 className="font-semibold mb-4">Tokenization Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Tokens to be Minted:</span>
                  <span className="font-medium">100 MPT</span>
                </div>
                <div className="flex justify-between">
                  <span>Token Value (per token):</span>
                  <span className="font-medium">
                    {formData.appraisalValue ? `$${(parseInt(formData.appraisalValue.replace(/,/g, '')) / 100).toLocaleString()}` : '$TBD'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Annual Yield:</span>
                  <span className="font-medium text-success">
                    {formData.monthlyRent && formData.appraisalValue ? 
                      `${((parseInt(formData.monthlyRent.replace(/,/g, '')) * 12) / parseInt(formData.appraisalValue.replace(/,/g, '')) * 100).toFixed(2)}%` : 
                      'TBD'
                    }
                  </span>
                </div>
              </div>
            </Card>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {requiredDocuments.map((doc, index) => (
                <Card key={index} className={`p-4 border-2 transition-all duration-300 ${
                  doc.uploaded ? 'border-success bg-success/5' : 
                  doc.required ? 'border-warning bg-warning/5' : 'border-border'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {doc.uploaded ? (
                        <CheckCircle className="w-5 h-5 text-success" />
                      ) : doc.required ? (
                        <AlertCircle className="w-5 h-5 text-warning" />
                      ) : (
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.required ? 'Required' : 'Optional'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={doc.uploaded ? "default" : "outline"}
                      size="sm"
                      onClick={() => !doc.uploaded && handleFileUpload(doc.name.toLowerCase().replace(' ', ''))}
                    >
                      {doc.uploaded ? 'Uploaded' : 'Upload'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-6 bg-primary/5 border-primary/20">
              <div className="flex items-start space-x-3">
                <Shield className="w-6 h-6 text-primary mt-1" />
                <div>
                  <h3 className="font-semibold text-primary mb-2">Document Security</h3>
                  <p className="text-sm text-muted-foreground">
                    All documents are encrypted and stored on IPFS with DID-based access control. 
                    Only verified validators and authorized parties can access your property documentation.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <Card className="p-6 bg-gradient-card">
              <h3 className="font-semibold mb-4">Identity Verification</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>DID Authentication</span>
                  <Badge variant="secondary">Pending</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Property Ownership Verification</span>
                  <Badge variant="secondary">Pending</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>KYC/AML Check</span>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-card">
              <h3 className="font-semibold mb-4">Professional Validation</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Notary Verification</span>
                  <Badge variant="secondary">Assigned</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Appraisal Review</span>
                  <Badge variant="secondary">In Progress</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Legal Document Review</span>
                  <Badge variant="secondary">Queued</Badge>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-success/5 border-success/20">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-6 h-6 text-success mt-1" />
                <div>
                  <h3 className="font-semibold text-success mb-2">Ready for Review</h3>
                  <p className="text-sm text-muted-foreground">
                    Your property tokenization request is complete and ready for professional validation. 
                    Tokens will be minted and locked in escrow once all verifications are approved.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
          Tokenize Your Property
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Transform your real estate into liquid, tradeable tokens. Our secure platform guides you through 
          every step of the tokenization process.
        </p>
        {!user && (
          <p className="text-sm text-warning mt-2">
            You'll need to <button onClick={() => navigate('/auth')} className="underline text-primary">sign in</button> to save or submit.
          </p>
        )}
      </div>

      {/* Progress Steps */}
      <div className="mb-12">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                  isActive ? 'border-primary bg-primary text-primary-foreground' :
                  isCompleted ? 'border-success bg-success text-success-foreground' :
                  'border-muted bg-background text-muted-foreground'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="ml-3 hidden md:block">
                  <p className={`text-sm font-medium ${isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'}`}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 md:w-16 h-0.5 mx-4 ${isCompleted ? 'bg-success' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Content */}
      <Card className="p-8 shadow-card">
        {renderStepContent()}
        
        <div className="flex justify-between mt-8 pt-6 border-t border-border">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
          </div>
          
          {currentStep < 4 ? (
            <Button
              onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
            >
              Next Step
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit for Tokenization'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default TokenizeSection;
