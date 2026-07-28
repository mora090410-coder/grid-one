import { createClient } from '@supabase/supabase-js';

type PagesFunction = (context: any) => Promise<Response> | Response;

const validAxis = (axis: unknown): axis is number[] =>
  Array.isArray(axis)
  && axis.length === 10
  && axis.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9)
  && new Set(axis).size === 10;

const publicLabel = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Publishing is not configured.' }, { status: 503 });
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Sign in before publishing.' }, { status: 401 });
  const auth = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData } = await auth.auth.getUser(token);
  if (!authData.user) return Response.json({ error: 'Your session has expired.' }, { status: 401 });

  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: contest, error } = await admin
    .from('contests')
    .select('id, share_code, owner_id, title, revision, settings, board_data, published_at, side_axis, top_axis, side_team_name, side_team_abbr, top_team_name, top_team_abbr, game_starts_at, payout_labels, board_activations(id)')
    .eq('id', String(params.id || ''))
    .eq('owner_id', authData.user.id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!contest) return Response.json({ error: 'Board not found.' }, { status: 404 });
  if (contest.published_at) {
    const [
      { data: existingSnapshot, error: existingSnapshotError },
      { count: assignmentCount, error: assignmentCountError },
    ] = await Promise.all([
      admin
        .from('public_board_snapshots')
        .select('contest_id')
        .eq('contest_id', contest.id)
        .maybeSingle(),
      admin
        .from('square_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('contest_id', contest.id),
    ]);
    if (existingSnapshotError) {
      return Response.json({ error: existingSnapshotError.message }, { status: 500 });
    }
    if (assignmentCountError) {
      return Response.json({ error: assignmentCountError.message }, { status: 500 });
    }
    if (existingSnapshot && assignmentCount === 100) {
      return Response.json({
        published: true,
        shareCode: contest.share_code,
        viewerUrl: `/b/${contest.share_code}`,
        alreadyPublished: true,
      });
    }
  }
  if (!Array.isArray(contest.board_activations) || !contest.board_activations.length) {
    return Response.json({ error: 'Unlock this board with the 2026 season pass before publishing.' }, { status: 402 });
  }

  const board = contest.board_data || {};
  const sideAxis = validAxis(board.bearsAxis) ? board.bearsAxis : contest.side_axis;
  const topAxis = validAxis(board.oppAxis) ? board.oppAxis : contest.top_axis;
  if (!validAxis(sideAxis) || !validAxis(topAxis)) {
    return Response.json({ error: 'Draw all ten unique axis digits before publishing.' }, { status: 409 });
  }
  if (!Array.isArray(board.squares) || board.squares.length !== 100) {
    return Response.json({ error: 'The board must contain exactly 100 squares.' }, { status: 409 });
  }
  const normalizedNames = board.squares.map((cell: unknown) =>
    Array.isArray(cell) ? cell.filter((name) => typeof name === 'string' && name.trim()).map((name) => String(name).trim()) : [],
  );
  const unassigned = normalizedNames.filter((names: string[]) => !names.length).length;
  if (unassigned) {
    return Response.json({ error: `${unassigned} squares are still unassigned. Finish the board before publishing.` }, { status: 409 });
  }
  const multiplyAssigned = normalizedNames.filter((names: string[]) => names.length !== 1).length;
  if (multiplyAssigned) {
    return Response.json({ error: `${multiplyAssigned} squares have more than one name. Use one purchaser identity per square before publishing.` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const firstPublish = !contest.published_at;
  const contestUpdate: Record<string, unknown> = {
    status: 'published',
    side_axis: sideAxis,
    top_axis: topAxis,
    published_at: contest.published_at || now,
  };
  if (!contest.published_at) {
    contestUpdate.axis_locked_at = now;
    contestUpdate.axis_locked_by = authData.user.id;
  }
  const { error: updateError } = await admin.from('contests').update(contestUpdate).eq('id', contest.id);
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  const uniqueNames = [...new Set<string>(normalizedNames.flat() as string[])];
  const participantByName = new Map<string, string>();
  for (const name of uniqueNames) {
    const { data: participant, error: participantError } = await admin
      .from('contest_participants')
      .upsert({
        contest_id: contest.id,
        display_name: name,
        public_label: publicLabel(name),
      }, { onConflict: 'contest_id,display_name' })
      .select('id, display_name')
      .single();
    if (participantError) return Response.json({ error: participantError.message }, { status: 500 });
    participantByName.set(participant.display_name, participant.id);
  }
  const assignments = normalizedNames.map((names: string[], cellIndex: number) => ({
    contest_id: contest.id,
    cell_index: cellIndex,
    participant_id: participantByName.get(names[0]),
  }));
  const { error: assignmentError } = await admin
    .from('square_assignments')
    .upsert(assignments, { onConflict: 'contest_id,cell_index' });
  if (assignmentError) return Response.json({ error: assignmentError.message }, { status: 500 });

  const publicBoard = {
    bearsAxis: sideAxis,
    oppAxis: topAxis,
    squares: normalizedNames,
    isDynamic: false,
    participants: uniqueNames.map((name) => ({
      id: participantByName.get(name),
      displayName: name,
      publicLabel: publicLabel(name),
    })),
  };
  const matchup = {
    sideTeamName: contest.side_team_name || contest.settings?.leftName,
    sideTeamAbbr: contest.side_team_abbr || contest.settings?.leftAbbr,
    topTeamName: contest.top_team_name || contest.settings?.topName,
    topTeamAbbr: contest.top_team_abbr || contest.settings?.topAbbr,
    gameDate: contest.game_starts_at || contest.settings?.dates,
  };
  const { error: snapshotError } = await admin.from('public_board_snapshots').upsert({
    contest_id: contest.id,
    share_code: contest.share_code,
    revision: contest.revision + 1,
    board_title: contest.title,
    matchup,
    board: publicBoard,
    payout_labels: contest.payout_labels || {},
    published_at: contest.published_at || now,
    updated_at: now,
    withdrawn_at: null,
  }, { onConflict: 'contest_id' });
  if (snapshotError) return Response.json({ error: snapshotError.message }, { status: 500 });
  await admin.from('contest_audit_events').insert({
    contest_id: contest.id,
    actor_id: authData.user.id,
    event_type: firstPublish ? 'board.published' : 'board.republished',
    previous_revision: contest.revision,
    next_revision: contest.revision + 1,
    details: { share_code: contest.share_code },
  });
  return Response.json({ published: true, shareCode: contest.share_code, viewerUrl: `/b/${contest.share_code}` });
};
