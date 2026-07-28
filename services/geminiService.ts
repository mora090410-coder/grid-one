import { BoardData } from '../types';
import { supabase } from './supabase';

export async function parseBoardImage(base64Image: string): Promise<BoardData> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in before importing a paper board.');

  const response = await fetch('/api/boards/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ image: base64Image }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The board scan could not be completed.');
  return result.board as BoardData;
}
