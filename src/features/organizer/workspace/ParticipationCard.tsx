import React from 'react';
import type { ParticipationDetails } from '../../../../types';
import { Glass, CapsuleInput } from '../../../design/primitives';

export default function ParticipationCard({details,onChange}: {details:ParticipationDetails;onChange:(details:ParticipationDetails)=>void}) {
 return <Glass padding="lg">
  <details>
   <summary className="min-h-11 cursor-pointer font-ui text-lg text-fg">Help people join</summary>
   <div className="mt-4 flex flex-col gap-4">
    <p className="text-sm text-fg-2">Everyone with the board link can see these optional details. Only enter contact information you intend to share.</p>
    <CapsuleInput label="What this board supports" maxLength={280} value={details.purpose??''} onChange={event=>onChange({...details,purpose:event.target.value})}/>
    <CapsuleInput label="Amount per square (optional)" maxLength={40} value={details.squarePrice??''} placeholder="$20" onChange={event=>onChange({...details,squarePrice:event.target.value})}/>
    <CapsuleInput label="How to join" maxLength={500} value={details.instructions??''} placeholder="Ask the family who shared this link for a square." onChange={event=>onChange({...details,instructions:event.target.value})}/>
    <p className="text-sm text-fg-2">GridOne tracks the board. It does not collect square money, hold funds, settle payments, or pay winners. Arrange payments outside the app.</p>
   </div>
  </details>
 </Glass>;
}
