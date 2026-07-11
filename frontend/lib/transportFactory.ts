/**
 * transportFactory — selects the correct PipecatTransport at runtime.
 *
 * Selection rule:
 *   NEXT_PUBLIC_PIPECAT_WS_URL set → WsTransport (real backend)
 *   not set                        → MockTransport (dev fallback)
 *
 * Called once per useCallSession mount via useMemo.
 * No business logic here — just construction.
 */
import { MockTransport } from './mockTransport';
import { WsTransport } from './wsTransport';
import type { PipecatTransport } from './transport';

export function createTransport(): PipecatTransport {
  const wsUrl = process.env.NEXT_PUBLIC_PIPECAT_WS_URL;
  if (wsUrl) {
    return new WsTransport(wsUrl);
  }
  return new MockTransport();
}
