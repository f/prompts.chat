import { afterEach, describe, expect, it, vi } from "vitest";
import { getMediaGeneratorPlugin } from "@/lib/plugins/media-generators";
import {
  generateMiniMaxMusic,
  MINIMAX_MUSIC_CONFIG,
  minimaxGeneratorPlugin,
  parseMiniMaxMusicResponse,
} from "@/lib/plugins/media-generators/minimax";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("MiniMax music generator", () => {
  it("publishes the current music models and formats", () => {
    expect(getMediaGeneratorPlugin("minimax")).toBe(minimaxGeneratorPlugin);
    expect(MINIMAX_MUSIC_CONFIG).toMatchObject({
      models: ["music-3.0", "music-2.6", "music-3.0-free", "music-2.6-free"],
      outputFormats: ["url", "hex"],
      streamOutputFormats: ["hex"],
      audioFormats: ["mp3", "wav", "pcm"],
      urlTtlHours: 24,
    });
  });

  it("sends the CN request fields and parses completed audio", async () => {
    vi.stubEnv("MINIMAX_API_KEY", "test-key");
    vi.stubEnv("MINIMAX_REGION", "cn_zh");
    vi.stubEnv("MINIMAX_AUDIO_FORMAT", "wav");
    vi.stubEnv("MINIMAX_SAMPLE_RATE", "44100");
    vi.stubEnv("MINIMAX_BITRATE", "256000");
    vi.stubEnv("MINIMAX_LYRICS", "[Verse]\nA bright new day");
    vi.stubEnv("MINIMAX_LYRICS_OPTIMIZER", "true");
    vi.stubEnv("MINIMAX_IS_INSTRUMENTAL", "false");
    vi.stubEnv("MINIMAX_AIGC_WATERMARK", "true");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { status: 2, audio: "https://example.test/music.wav" },
          base_resp: { status_code: 0 },
        }),
        { status: 200 },
      ),
    );

    await expect(
      generateMiniMaxMusic({
        prompt: "A bright instrumental theme",
        model: "music-3.0",
        type: "audio",
      }),
    ).resolves.toBe("https://example.test/music.wav");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.minimaxi.com/v1/music_generation",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({
      model: "music-3.0",
      prompt: "A bright instrumental theme",
      stream: false,
      output_format: "url",
      audio_setting: { format: "wav", sample_rate: 44100, bitrate: 256000 },
      lyrics: "[Verse]\nA bright new day",
      lyrics_optimizer: true,
      is_instrumental: false,
      aigc_watermark: true,
    });
  });

  it("uses the global endpoint and exposes audio models when configured", () => {
    vi.stubEnv("MINIMAX_API_KEY", "test-key");
    expect(minimaxGeneratorPlugin.getModels()).toHaveLength(4);
    expect(MINIMAX_MUSIC_CONFIG.endpoints.global_en).toBe(
      "https://api.minimax.io/v1/music_generation",
    );
  });

  it("rejects models outside the music generation registry", async () => {
    vi.stubEnv("MINIMAX_API_KEY", "test-key");

    await expect(
      generateMiniMaxMusic({
        prompt: "A bright instrumental theme",
        model: "unsupported-model",
        type: "audio",
      }),
    ).rejects.toThrow("Unsupported MiniMax music generation model");
  });

  it("rejects unsuccessful responses", () => {
    expect(() =>
      parseMiniMaxMusicResponse({
        data: { status: 1 },
        base_resp: { status_code: 1004, status_msg: "Authentication failed" },
      }),
    ).toThrow("Authentication failed");
  });

  it("parses hex audio responses into playable data URLs", () => {
    expect(
      parseMiniMaxMusicResponse(
        {
          data: { status: 2, audio: "67656e6572617465642d617564696f" },
          base_resp: { status_code: 0 },
        },
        "hex",
        "wav",
      ),
    ).toBe("data:audio/wav;base64,Z2VuZXJhdGVkLWF1ZGlv");
  });

  it("rejects malformed hex audio responses", () => {
    expect(() =>
      parseMiniMaxMusicResponse(
        {
          data: { status: 2, audio: "not-hex" },
          base_resp: { status_code: 0 },
        },
        "hex",
      ),
    ).toThrow("invalid hex audio");
  });

  it("rejects unsafe audio output URLs", () => {
    expect(() =>
      parseMiniMaxMusicResponse({
        data: { status: 2, audio: "javascript:alert(1)" },
        base_resp: { status_code: 0 },
      }),
    ).toThrow("insecure audio URL");
  });
});
