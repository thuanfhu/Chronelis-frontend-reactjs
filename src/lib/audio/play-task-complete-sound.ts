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
) {
  const oscillator = context.createOscillator()
  const gainNode = context.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startAt)
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.018, startAt + duration)

  gainNode.gain.setValueAtTime(0.0001, startAt)
  gainNode.gain.exponentialRampToValueAtTime(gainAmount, startAt + 0.02)
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

    const now = context.currentTime + 0.02
    scheduleTone(context, 783.99, now, 0.18, 0.03)
    scheduleTone(context, 1046.5, now + 0.09, 0.2, 0.028)
    scheduleTone(context, 1318.51, now + 0.18, 0.26, 0.024)
  } catch {
    // Ignore audio failures to avoid blocking task completion.
  }
}