import {cleanup, render, screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import {MockSelection} from '../src/features/Mock';
vi.mock('../src/services/api',()=>({api:vi.fn().mockResolvedValue({results:[]}),post:vi.fn()}));
afterEach(cleanup);
it('explains question-only mocks without promising audio playback',()=>{
 render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><MockSelection materialId={42} available audioAvailable={false}/></MemoryRouter></QueryClientProvider>);
 expect(screen.getByText(/Audio has not been added yet/)).toBeTruthy();
 expect(screen.getByText(/You can enter, save and submit/)).toBeTruthy();
 expect(screen.queryByText(/recording plays once/)).toBeNull();
 expect(screen.getByRole('button',{name:/Start Mock/})).toBeEnabled();
});
