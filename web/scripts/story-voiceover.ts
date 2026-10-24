import { writeFile } from 'node:fs/promises'
import { scenes, starts } from '../src/story/scenes.ts'
const text = scenes.map((scene, i) => `${i + 1}. [${starts[i]}–${starts[i] + scene.duration}s] ${scene.cues.map(cue => cue.voiceover).join(' ')}`).join('\n') + '\n'
await writeFile(new URL('../public/story-voiceover.txt', import.meta.url), text)
console.log('Generated eight scene lines from the playback configuration.')
