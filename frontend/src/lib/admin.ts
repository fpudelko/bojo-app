import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

export function useAdmin(): boolean {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { setIsAdmin(data?.is_admin ?? false); }, () => { setIsAdmin(false); });
  }, [user?.id]);

  return isAdmin;
}
