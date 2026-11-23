import { supabase } from './supabase';

/** What decides whether a conversation is a message request for the signed-in person. */
export type RequestContext = {
  messaged: Set<string>;
  following: Set<string>;
  accepted: Set<string>;
  declined: Set<string>;
};

export async function loadRequestContext(meId: string): Promise<RequestContext> {
  const [sent, follows, decisions] = await Promise.all([
    supabase.from('messages').select('recipient_id').eq('sender_id', meId).limit(2000),
    supabase.from('follows').select('followee_id').eq('follower_id', meId).eq('state', 'active').limit(5000),
    supabase.from('message_request_decisions').select('other_id, decision').eq('user_id', meId),
  ]);
  const d = decisions.data ?? [];
  return {
    messaged: new Set((sent.data ?? []).map((r) => r.recipient_id)),
    following: new Set((follows.data ?? []).map((r) => r.followee_id)),
    accepted: new Set(d.filter((r) => r.decision === 'accepted').map((r) => r.other_id)),
    declined: new Set(d.filter((r) => r.decision === 'declined').map((r) => r.other_id)),
  };
}

/** A request is a conversation the person never joined, from someone they don't follow and haven't accepted. */
export function isRequest(ctx: RequestContext, otherId: string): boolean {
  return !ctx.messaged.has(otherId) && !ctx.following.has(otherId) && !ctx.accepted.has(otherId);
}
