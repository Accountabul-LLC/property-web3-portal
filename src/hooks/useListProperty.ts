import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

export interface StandardListingInput {
  title: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  description: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  year_built: number | null;
  listing_price: number | null;
  contact_email: string;
  contact_phone: string;
  images: string[];
  vendor_profile_id: string;
}

export function useListProperty() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  async function createStandardListing(input: StandardListingInput): Promise<string> {
    if (!user) throw new Error('Sign in required');
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        owner_user_id: user.id,
        vendor_profile_id: input.vendor_profile_id,
        listing_kind: 'standard',
        status: 'active',
        title: input.title,
        address: input.address,
        city: input.city,
        state: input.state,
        zip: input.zip,
        description: input.description,
        property_type: input.property_type,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        square_feet: input.square_feet,
        year_built: input.year_built,
        listing_price: input.listing_price,
        contact_email: input.contact_email,
        contact_phone: input.contact_phone,
        images: input.images,
      };
      const { data, error } = await (supabase.from('properties' as any) as any)
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['properties'] });
      return (data as { id: string }).id;
    } finally {
      setSubmitting(false);
    }
  }

  return { createStandardListing, submitting };
}
