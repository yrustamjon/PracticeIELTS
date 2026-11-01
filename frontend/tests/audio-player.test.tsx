import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AudioPlayer } from "../src/components/AudioPlayer";

afterEach(() => {cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});

it("authorizes native playback without downloading the complete file and retries errors", async () => {
  const fetchMock=vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({detail:'Unavailable'}),{status:503}))
    .mockResolvedValueOnce(new Response(JSON.stringify({url:'/api/v1/audio/2/stream/',expires_in:600}),{headers:{'Content-Type':'application/json'}}));
  vi.stubGlobal('fetch',fetchMock);
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  const {container}=render(<AudioPlayer url='/api/v1/audio/2/stream/'/>);
  await screen.findByRole('alert');
  expect(screen.getByRole('button',{name:'Play audio'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Retry audio'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Play audio'})).toBeEnabled());
  expect(container.querySelector('audio')).toHaveAttribute('src','/api/v1/audio/2/stream/');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.every(call=>call[0]==='/api/v1/audio/2/playback/')).toBe(true);
  fireEvent.waiting(container.querySelector('audio')!);
  expect(screen.getByText('Buffering audio…')).toBeVisible();
  fireEvent.canPlay(container.querySelector('audio')!);
  expect(screen.queryByText('Buffering audio…')).toBeNull();
});
