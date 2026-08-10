import { BoardData } from '../types';
import { supabase } from './supabase';

// Client half of paper-board import. No model provider is referenced here on
// purpose: the vision call lives server-side in functions/api/boards/scan.ts,
// so swapping or disabling the provider never touches the client.

/** Sends a board photo to the server-side scanner and returns an editable grid. */
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
