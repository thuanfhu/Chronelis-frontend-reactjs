import fs from 'node:fs'
import path from 'node:path'

const SAMPLE_RATE = 44100
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/audio/pomodoro')

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function envelope(time, duration, attack = 0.01, release = 0.12) {
  if (time < 0 || time > duration) {
    return 0
  }

  if (time < attack) {
    return time / attack
  }

  const releaseStart = Math.max(attack, duration - release)
  if (time > releaseStart) {
    return Math.max(0, (duration - time) / Math.max(duration - releaseStart, 1e-6))
  }

  return 1
}

function sine(frequency, time) {
  return Math.sin(2 * Math.PI * frequency * time)
}

function partialTone({
  time,
  start,
  duration,
  frequency,
  gain,
  decay,
  harmonics = [
    { ratio: 2, gain: 0.25 },
    { ratio: 3, gain: 0.12 },
  ],
}) {
  const localTime = time - start
  if (localTime < 0 || localTime > duration) {
    return 0
  }

  const env = envelope(localTime, duration, 0.004, duration * 0.6)
  const damping = Math.exp(-decay * localTime)

  let value = sine(frequency, localTime)
  for (const harmonic of harmonics) {
    value += harmonic.gain * sine(frequency * harmonic.ratio, localTime)
  }

  return value * gain * env * damping
}

function normalizedNoise(seed) {
  const value = Math.sin(seed * 127.1) * 43758.5453123
  return (value - Math.floor(value)) * 2 - 1
}

function generateSamples(durationSeconds, sampleFn) {
  const totalSamples = Math.floor((durationSeconds + 0.18) * SAMPLE_RATE)
  const samples = new Float32Array(totalSamples)

  let peak = 0
  for (let index = 0; index < totalSamples; index += 1) {
    const time = index / SAMPLE_RATE
    const sample = sampleFn(time, index)
    samples[index] = sample
    peak = Math.max(peak, Math.abs(sample))
  }

  const scale = peak > 0 ? 0.9 / peak : 1
  for (let index = 0; index < totalSamples; index += 1) {
    samples[index] = clamp(samples[index] * scale, -1, 1)
  }

  return samples
}

function writeWav(filePath, samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples.length * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples.length * 2, 40)

  for (let index = 0; index < samples.length; index += 1) {
    const int16 = Math.max(-32768, Math.min(32767, Math.round(samples[index] * 32767)))
    buffer.writeInt16LE(int16, 44 + index * 2)
  }

  fs.writeFileSync(filePath, buffer)
}

const PRESETS = [
  {
    fileName: 'crystal-bell.wav',
    durationSeconds: 1.05,
    sampleFn: (time) => (
      partialTone({ time, start: 0, duration: 0.52, frequency: 783.99, gain: 0.62, decay: 4.4 })
      + partialTone({ time, start: 0.08, duration: 0.58, frequency: 987.77, gain: 0.45, decay: 4.1 })
      + partialTone({ time, start: 0.16, duration: 0.62, frequency: 1318.51, gain: 0.36, decay: 3.8 })
    ),
  },
  {
    fileName: 'digital-chime.wav',
    durationSeconds: 0.86,
    sampleFn: (time) => (
      partialTone({
        time,
        start: 0,
        duration: 0.16,
        frequency: 1046.5,
        gain: 0.68,
        decay: 8.5,
        harmonics: [
          { ratio: 2, gain: 0.18 },
          { ratio: 4, gain: 0.1 },
        ],
      })
      + partialTone({
        time,
        start: 0.18,
        duration: 0.18,
        frequency: 1318.51,
        gain: 0.62,
        decay: 8.4,
        harmonics: [
          { ratio: 2, gain: 0.16 },
          { ratio: 4, gain: 0.12 },
        ],
      })
      + partialTone({
        time,
        start: 0.36,
        duration: 0.22,
        frequency: 1567.98,
        gain: 0.56,
        decay: 8.2,
        harmonics: [
          { ratio: 2, gain: 0.14 },
          { ratio: 3, gain: 0.08 },
        ],
      })
    ),
  },
  {
    fileName: 'soft-bloom.wav',
    durationSeconds: 1.12,
    sampleFn: (time) => (
      partialTone({
        time,
        start: 0,
        duration: 0.6,
        frequency: 523.25,
        gain: 0.56,
        decay: 3.3,
        harmonics: [
          { ratio: 2, gain: 0.12 },
          { ratio: 0.5, gain: 0.16 },
        ],
      })
      + partialTone({
        time,
        start: 0.14,
        duration: 0.66,
        frequency: 659.25,
        gain: 0.45,
        decay: 3.1,
        harmonics: [
          { ratio: 2, gain: 0.1 },
          { ratio: 0.5, gain: 0.1 },
        ],
      })
      + partialTone({
        time,
        start: 0.28,
        duration: 0.72,
        frequency: 783.99,
        gain: 0.38,
        decay: 2.9,
        harmonics: [
          { ratio: 2, gain: 0.09 },
          { ratio: 0.5, gain: 0.08 },
        ],
      })
    ),
  },
  {
    fileName: 'deep-gong.wav',
    durationSeconds: 1.24,
    sampleFn: (time, index) => {
      const base = (
        partialTone({
          time,
          start: 0,
          duration: 0.95,
          frequency: 196,
          gain: 0.74,
          decay: 2.7,
          harmonics: [
            { ratio: 2, gain: 0.24 },
            { ratio: 3, gain: 0.12 },
          ],
        })
        + partialTone({
          time,
          start: 0.12,
          duration: 0.88,
          frequency: 261.63,
          gain: 0.44,
          decay: 2.9,
          harmonics: [
            { ratio: 2, gain: 0.2 },
            { ratio: 4, gain: 0.08 },
          ],
        })
      )

      const shimmerTime = time - 0.04
      const shimmer = shimmerTime > 0 && shimmerTime < 0.24
        ? normalizedNoise(index * 0.09) * 0.025 * envelope(shimmerTime, 0.24, 0.002, 0.18)
        : 0

      return base + shimmer
    },
  },
  {
    fileName: 'wood-block.wav',
    durationSeconds: 0.92,
    sampleFn: (time, index) => {
      const bursts = [0, 0.12, 0.24]
      let value = 0

      for (const start of bursts) {
        const localTime = time - start
        if (localTime < 0 || localTime > 0.1) {
          continue
        }

        const env = envelope(localTime, 0.1, 0.001, 0.065)
        const click = sine(720 + start * 35, localTime) * 0.34
        const thump = sine(180 + start * 20, localTime) * 0.27
        const texture = normalizedNoise(index * (start + 1.3)) * 0.07
        value += (click + thump + texture) * env
      }

      return value
    },
  },
]

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

for (const preset of PRESETS) {
  const samples = generateSamples(preset.durationSeconds, preset.sampleFn)
  const outputFilePath = path.join(OUTPUT_DIR, preset.fileName)
  writeWav(outputFilePath, samples)
  console.log(`Generated ${outputFilePath}`)
}
