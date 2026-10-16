import { processImageLocally } from './process-image'
import type { Media } from '../model'

self.onmessage = async (event: MessageEvent<Media>) => {
  try { self.postMessage({ result: await processImageLocally(event.data) }) }
  catch (error) { self.postMessage({ error: String(error) }) }
}
