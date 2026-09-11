import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ParticipationCard from '../../src/features/organizer/workspace/ParticipationCard';
it('labels public fields explicitly and saves only entered details',()=>{
 const onChange=vi.fn(); render(<ParticipationCard details={{}} onChange={onChange}/>);
 fireEvent.change(screen.getByLabelText('How to join'),{target:{value:'Text the team organizer'}});
 expect(onChange).toHaveBeenCalledWith({instructions:'Text the team organizer'});
 expect(screen.getByText(/Everyone with the board link/)).toBeInTheDocument();
 expect(screen.getByText(/does not collect square money/)).toBeInTheDocument();
});
