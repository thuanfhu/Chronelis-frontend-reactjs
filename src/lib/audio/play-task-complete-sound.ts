let audioContext: AudioContext | null = null

type AudioContextWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

function getAudioContext() {
  if (typeof window === 'undefined') {
    return null
  }

  const audioWindow = window as AudioContextWindow
  const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext
  if (!AudioContextCtor) {
    return null
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor()
  }

  return audioContext
}

function scheduleTone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  gainAmount: number,
  oscillatorType: OscillatorType = 'sine',
) {
  const oscillator = context.createOscillator()
  const gainNode = context.createGain()

  oscillator.type = oscillatorType
  oscillator.frequency.setValueAtTime(frequency, startAt)
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.996, startAt + duration)

  gainNode.gain.setValueAtTime(0.0001, startAt)
  gainNode.gain.exponentialRampToValueAtTime(gainAmount, startAt + 0.012)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  oscillator.connect(gainNode)
  gainNode.connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

export async function playTaskCompleteSound() {
  try {
    const context = getAudioContext()
    if (!context) {
      return
    }

    if (context.state === 'suspended') {
      await context.resume()
    }

    const now = context.currentTime + 0.015
    scheduleTone(context, 1318.51, now, 0.62, 0.12)
    scheduleTone(context, 2637.02, now + 0.01, 0.82, 0.065)
    scheduleTone(context, 3951.07, now + 0.02, 0.96, 0.035)
    scheduleTone(context, 1760, now, 0.14, 0.08, 'triangle')
  } catch {
    // Ignore audio failures to avoid blocking task completion.
  }
}