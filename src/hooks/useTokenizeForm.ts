import { useState, useEffect } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TokenizeFormData {
  propertyAddress: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  propertyType: string;
  squareFootage: string;
  bedrooms: string;
  bathrooms: string;
  lotSize: string;
  yearBuilt: string;
  appraisalValue: string;
  monthlyRent: string;
  description: string;
  zoning: string;
  propertyTax: string;
}

const initialFormData: TokenizeFormData = {
  propertyAddress: '',
  unit: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
  propertyType: '',
  squareFootage: '',
  bedrooms: '',
  bathrooms: '',
  lotSize: '',
  yearBuilt: '',
  appraisalValue: '',
  monthlyRent: '',
  description: '',
  zoning: '',
  propertyTax: '',
};

const optionalText = (max: number) => z.string().max(max, `Must be at most ${max} characters`).optional().or(z.literal(''));
const decimalString = (label: string, max = 20) =>
  z.string()
    .max(max, `${label} must be at most ${max} characters`)
    .refine((value) => value === '' || /^\d+(\.\d+)?$/.test(value), `${label} must be a number`);

const tokenizeFormSchema = z.object({
  propertyAddress: optionalText(200),
  unit: optionalText(50),
  city: optionalText(100),
  state: optionalText(100),
  zip: optionalText(10),
  country: optionalText(100),
  propertyType: optionalText(80),
  squareFootage: decimalString('Square footage'),
  bedrooms: decimalString('Bedrooms', 10),
  bathrooms: decimalString('Bathrooms', 10),
  lotSize: decimalString('Lot size'),
  yearBuilt: z.string().max(4, 'Year built must be at most 4 characters').refine((value) => value === '' || /^\d+$/.test(value), 'Year built must be numeric'),
  appraisalValue: decimalString('Appraised value'),
  monthlyRent: decimalString('Monthly rent'),
  description: optionalText(2000),
  zoning: optionalText(80),
  propertyTax: decimalString('Property tax'),
});

export function useTokenizeForm(editId?: string | null) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<TokenizeFormData>(initialFormData);
  const [propertyId, setPropertyId] = useState<string | null>(editId || null);
  const [saving, setSaving] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [propertyStatus, setPropertyStatus] = useState<string | null>(null);

  // Load existing property when editId is provided
  useEffect(() => {
    if (!editId) return;
    setLoadingDraft(true);
    supabase
      .from('properties' as any)
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadingDraft(false);
          return;
        }
        const p = data as any;
        setPropertyId(p.id);
        setPropertyStatus(p.status);
        const addr = p.address || '';
        setFormData({
          propertyAddress: addr,
          unit: '',
          city: p.city || '',
          state: p.state || '',
          zip: p.zip || '',
          country: 'US',
          propertyType: p.property_type || '',
          squareFootage: p.square_feet ? String(p.square_feet) : '',
          bedrooms: p.bedrooms ? String(p.bedrooms) : '',
          bathrooms: p.bathrooms ? String(p.bathrooms) : '',
          lotSize: '',
          yearBuilt: p.year_built ? String(p.year_built) : '',
          appraisalValue: p.estimated_value ? String(p.estimated_value) : '',
          monthlyRent: '',
          description: p.description || '',
          zoning: '',
          propertyTax: '',
        });
        setLoadingDraft(false);
      });
  }, [editId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateFormData = () => {
    const parsed = tokenizeFormSchema.safeParse(formData);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Please check the property details for invalid values.';
      toast.error(message);
      return null;
    }
    return parsed.data;
  };

  const parseNum = (val: string) => {
    const n = parseFloat(val.replace(/,/g, ''));
    return isNaN(n) ? null : n;
  };

  const buildRow = (status: 'draft' | 'submitted') => ({
    owner_user_id: user?.id,
    title: formData.propertyAddress || 'Untitled Property',
    address: formData.unit ? `${formData.propertyAddress}, ${formData.unit}` : formData.propertyAddress,
    address_display: [formData.propertyAddress, formData.unit, formData.city, formData.state, formData.zip, formData.country].filter(Boolean).join(', '),
    city: formData.city || null,
    state: formData.state || null,
    zip: formData.zip || null,
    property_type: formData.propertyType || null,
    square_feet: parseNum(formData.squareFootage) ? Math.round(parseNum(formData.squareFootage)!) : null,
    bedrooms: parseNum(formData.bedrooms) ? Math.round(parseNum(formData.bedrooms)!) : null,
    bathrooms: parseNum(formData.bathrooms),
    year_built: parseNum(formData.yearBuilt) ? Math.round(parseNum(formData.yearBuilt)!) : null,
    estimated_value: parseNum(formData.appraisalValue),
    description: formData.description || null,
    status,
    ...(status === 'submitted' ? { submitted_at: new Date().toISOString() } : {}),
  });

  const saveDraft = async () => {
    if (!user) {
      toast.error('Please sign in to save your property.');
      return null;
    }
    setSaving(true);
    try {
      if (!validateFormData()) {
        return null;
      }
      const row = buildRow('draft');
      if (propertyId) {
        const { error } = await supabase
          .from('properties' as any)
          .update(row as any)
          .eq('id', propertyId);
        if (error) throw error;
        toast.success('Draft saved.');
        return propertyId;
      } else {
        const { data, error } = await supabase
          .from('properties' as any)
          .insert(row as any)
          .select('id')
          .single();
        if (error) throw error;
        const id = (data as any).id;
        setPropertyId(id);
        toast.success('Draft created.');
        return id;
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save draft.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submitForTokenization = async () => {
    if (!user) {
      toast.error('Please sign in to submit.');
      return false;
    }
    setSaving(true);
    try {
      if (!validateFormData()) {
        return false;
      }
      let id = propertyId;
      if (!id) {
        // Save as draft first, then update to submitted
        id = await saveDraft();
        if (!id) return false;
      }
      const { error } = await supabase
        .from('properties' as any)
        .update({ status: 'submitted', submitted_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
      toast.success('Property submitted for tokenization!');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Submission failed.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    formData,
    handleInputChange,
    saveDraft,
    submitForTokenization,
    saving,
    propertyId,
    setFormData,
    loadingDraft,
    propertyStatus,
    validateFormData,
  };
}
