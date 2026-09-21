import { ownerInvites, type GuestContext } from '../../../_lib/guestInvites';
export const onRequestGet = (context: GuestContext) => ownerInvites(context, false);
export const onRequestPost = (context: GuestContext) => ownerInvites(context, true);
