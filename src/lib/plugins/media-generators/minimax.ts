import type {
  GenerationRequest,
  GenerationTask,
  MediaGeneratorModel,
  MediaGeneratorPlugin,
  PollStatusResult,
  WebSocketHandler,
} from "./types";

export const MINIMAX_MUSIC_CONFIG = {
  endpoints: {
    global_en: "https://api.minimax.io/v1/music_generation",
    cn_zh: "https://api.minimaxi.com/v1/music_generation",
  },
  models: ["music-3.0", "music-2.6", "music-3.0-free", "music-2.6-free"],
  outputFormats: ["url", "hex"],
  streamOutputFormats: ["hex"],
  audioFormats: ["mp3", "wav", "pcm"],
  urlTtlHours: 24,
} as const;

type MiniMaxRegion = keyof typeof MINIMAX_MUSIC_CONFIG.endpoints;
type MiniMaxAudioFormat = (typeof MINIMAX_MUSIC_CONFIG.audioFormats)[number];
type MiniMaxOutputFormat = (typeof MINIMAX_MUSIC_CONFIG.outputFormats)[number];

interface MiniMaxMusicResponse {
  data?: { status?: number; audio?: string };
  base_resp?: { status_code?: number; status_msg?: string };
}

function readChoice<T extends string>(
  value: string | undefined,
  choices: readonly T[],
  fallback: T,
): T {
  return choices.find((choice) => choice === value) ?? fallback;
}

function readBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function musicModels(): MediaGeneratorModel[] {
  return MINIMAX_MUSIC_CONFIG.models.map((id) => ({ id, name: id, type: "audio" }));
}

function assertSecureAudioUrl(audio: string): string {
  let url: URL;
  try {
    url = new URL(audio);
  } catch {
    throw new Error("MiniMax music generation returned an invalid audio URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("MiniMax music generation returned an insecure audio URL");
  }
  return audio;
}

export function parseMiniMaxMusicResponse(
  result: MiniMaxMusicResponse,
  outputFormat: MiniMaxOutputFormat = "url",
  audioFormat: MiniMaxAudioFormat = "mp3",
): string {
  if (result.base_resp?.status_code !== 0) {
    throw new Error(result.base_resp?.status_msg || "MiniMax music generation failed");
  }
  if (result.data?.status !== 2 || !result.data.audio) {
    throw new Error("MiniMax music generation did not return completed audio");
  }
  if (outputFormat === "url") {
    return assertSecureAudioUrl(result.data.audio);
  }
  if (
    result.data.audio.length % 2 !== 0 ||
    !/^[0-9a-f]+$/i.test(result.data.audio)
  ) {
    throw new Error("MiniMax music generation returned invalid hex audio");
  }
  const mediaType = audioFormat === "mp3" ? "mpeg" : audioFormat;
  return `data:audio/${mediaType};base64,${Buffer.from(result.data.audio, "hex").toString("base64")}`;
}

export async function generateMiniMaxMusic(
  request: GenerationRequest,
): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("MINIMAX_API_KEY is not configured");
  if (
    request.type !== "audio" ||
    !MINIMAX_MUSIC_CONFIG.models.some((model) => model === request.model)
  ) {
    throw new Error("Unsupported MiniMax music generation model");
  }

  const region = readChoice<MiniMaxRegion>(
    process.env.MINIMAX_REGION,
    ["global_en", "cn_zh"],
    "global_en",
  );
  const audioFormat = readChoice<MiniMaxAudioFormat>(
    process.env.MINIMAX_AUDIO_FORMAT,
    MINIMAX_MUSIC_CONFIG.audioFormats,
    "mp3",
  );

  const audioSetting: Record<string, string | number> = { format: audioFormat };
  const sampleRate = readPositiveInteger(process.env.MINIMAX_SAMPLE_RATE);
  const bitrate = readPositiveInteger(process.env.MINIMAX_BITRATE);
  if (sampleRate !== undefined) audioSetting.sample_rate = sampleRate;
  if (bitrate !== undefined) audioSetting.bitrate = bitrate;

  const lyrics = process.env.MINIMAX_LYRICS?.trim();
  const lyricsOptimizer = readBoolean(process.env.MINIMAX_LYRICS_OPTIMIZER);
  const isInstrumental = readBoolean(process.env.MINIMAX_IS_INSTRUMENTAL);
  const aigcWatermark = readBoolean(process.env.MINIMAX_AIGC_WATERMARK);

  const payload: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    stream: false,
    output_format: "url",
    audio_setting: audioSetting,
  };
  if (lyrics) payload.lyrics = lyrics;
  if (lyricsOptimizer !== undefined) payload.lyrics_optimizer = lyricsOptimizer;
  if (isInstrumental !== undefined) payload.is_instrumental = isInstrumental;
  if (region === "cn_zh" && aigcWatermark !== undefined) {
    payload.aigc_watermark = aigcWatermark;
  }

  const response = await fetch(MINIMAX_MUSIC_CONFIG.endpoints[region], {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`);
  }
  return parseMiniMaxMusicResponse(await response.json(), "url", audioFormat);
}

const noWebSocketHandler: WebSocketHandler = {
  getInitMessage: () => "",
  handleMessage: () => undefined,
};

export const minimaxGeneratorPlugin: MediaGeneratorPlugin = {
  id: "minimax",
  name: "MiniMax",
  isConfigured: () => Boolean(process.env.MINIMAX_API_KEY),
  isEnabled: () => minimaxGeneratorPlugin.isConfigured(),
  getModels: () => (minimaxGeneratorPlugin.isEnabled() ? musicModels() : []),
  async startGeneration(request: GenerationRequest): Promise<GenerationTask> {
    const audio = await generateMiniMaxMusic(request);
    return { taskId: "completed", socketAccessToken: audio };
  },
  getWebSocketUrl: () => "",
  webSocketHandler: noWebSocketHandler,
  async checkStatus(audio: string): Promise<PollStatusResult> {
    const outputUrl = assertSecureAudioUrl(audio);
    return {
      status: "completed",
      statusKey: "complete",
      progress: 100,
      outputUrls: [outputUrl],
    };
  },
};
