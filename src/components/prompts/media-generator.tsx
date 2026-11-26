"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Wand2, Upload, ChevronDown, AlertCircle, CheckCircle2, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import type { WebSocketHandler, WebSocketCallbacks, GenerationStatusKey, AspectRatio } from "@/lib/plugins/media-generators/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "1:1", label: "1:1 (Square)" },
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
  { value: "4:3", label: "4:3 (Standard)" },
  { value: "3:4", label: "3:4 (Portrait)" },
  { value: "3:2", label: "3:2 (Photo)" },
  { value: "2:3", label: "2:3 (Portrait)" },
];
import { getProviderWebSocketHandler } from "@/lib/plugins/media-generators";

interface MediaGeneratorModel {
  id: string;
  name: string;
  type: "image" | "video" | "audio";
  provider: string;
  providerName: string;
  providerLogo?: string;
  providerLogoDark?: string;
}

interface MediaGeneratorProps {
  prompt: string;
  mediaType: "IMAGE" | "VIDEO" | "AUDIO";
  onMediaGenerated: (url: string) => void;
  onUploadClick: () => void;
  inputImageUrl?: string;
}

type GenerationStatus = 
  | "idle"
  | "confirming"
  | "starting"
  | "queued"
  | "processing"
  | "completed"
  | "error";

// Replace prompt variables with default values or placeholder text
function fillPromptVariables(prompt: string): string {
  // Match ${variable} or ${variable:default}
  return prompt.replace(/\$\{([^}:]+)(?::([^}]*))?\}/g, (match, varName, defaultValue) => {
    // Use default value if provided, otherwise use placeholder
    return defaultValue || `(example ${varName})`;
  });
}


export function MediaGenerator({
  prompt,
  mediaType,
  onMediaGenerated,
  onUploadClick,
  inputImageUrl: externalInputImageUrl,
}: MediaGeneratorProps) {
  const t = useTranslations("prompts");
  const [models, setModels] = useState<MediaGeneratorModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<MediaGeneratorModel | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [statusKey, setStatusKey] = useState<GenerationStatusKey | null>(null);
  const [progress, setProgress] = useState(0);
  const [inputImageUrl, setInputImageUrl] = useState<string>(externalInputImageUrl || "");
  const [inputImageUploadMode, setInputImageUploadMode] = useState(false);
  const [isUploadingInputImage, setIsUploadingInputImage] = useState(false);
  const inputImageFileRef = useRef<HTMLInputElement>(null);

  // Get translated status message
  const statusMessage = statusKey ? t(`mediaGeneration.${statusKey}`) : "";
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Sync external input image URL
  useEffect(() => {
    setInputImageUrl(externalInputImageUrl || "");
  }, [externalInputImageUrl]);

  // Fetch available models
  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch("/api/media-generate");
        if (response.ok) {
          const data = await response.json();
          const relevantModels = mediaType === "IMAGE" 
            ? data.imageModels 
            : mediaType === "VIDEO" 
              ? data.videoModels 
              : data.audioModels;
          setModels(relevantModels || []);
        }
      } catch (err) {
        console.error("Failed to fetch media generation models:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchModels();
  }, [mediaType]);

  const cleanupWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupWebSocket();
    };
  }, [cleanupWebSocket]);

  const handleInputImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(t("fileTooLarge"));
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t("invalidFileType"));
      return;
    }

    setIsUploadingInputImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      setInputImageUrl(result.url);
      setInputImageUploadMode(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploadingInputImage(false);
      if (inputImageFileRef.current) {
        inputImageFileRef.current.value = "";
      }
    }
  };

  const handleGenerate = async () => {
    if (!selectedModel) return;
    
    setStatus("starting");
    setError(null);
    setProgress(10);
    setStatusKey("connecting");

    try {
      const response = await fetch("/api/media-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fillPromptVariables(prompt),
          model: selectedModel.id,
          provider: selectedModel.provider,
          type: selectedModel.type,
          inputImageUrl,
          resolution: "1K",
          aspectRatio,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start generation");
      }

      const { socketAccessToken, webSocketUrl, provider } = await response.json();

      // Create callbacks for completion handling
      const handleComplete = (urls: string[]) => {
        if (urls.length > 0) {
          onMediaGenerated(urls[0]);
          toast.success(t("mediaGenerated"));
        }
        // Reset after a delay
        setTimeout(() => {
          setStatus("idle");
          setProgress(0);
          setStatusKey(null);
          setSelectedModel(null);
        }, 2000);
      };

      // Check if provider uses polling (empty webSocketUrl) or WebSocket
      if (!webSocketUrl) {
        // Polling mode (for Fal.ai)
        setStatus("queued");
        setProgress(20);
        setStatusKey("queued");

        const pollStatus = async () => {
          try {
            const statusResponse = await fetch(
              `/api/media-generate/status?provider=${provider}&token=${encodeURIComponent(socketAccessToken)}`
            );
            
            if (!statusResponse.ok) {
              const data = await statusResponse.json();
              throw new Error(data.error || "Status check failed");
            }

            const statusData = await statusResponse.json();
            
            setProgress(statusData.progress);
            if (statusData.statusKey) {
              setStatusKey(statusData.statusKey);
            }

            if (statusData.status === "completed") {
              setStatus("completed");
              if (statusData.outputUrls && statusData.outputUrls.length > 0) {
                handleComplete(statusData.outputUrls);
              }
              return; // Stop polling
            }

            if (statusData.status === "failed") {
              setStatus("error");
              setError("Generation failed");
              return; // Stop polling
            }

            // Continue polling
            if (statusData.status === "in_queue" || statusData.status === "in_progress") {
              setStatus("processing");
              setTimeout(pollStatus, 2000); // Poll every 2 seconds
            }
          } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Polling failed");
          }
        };

        // Start polling
        pollStatus();
      } else {
        // WebSocket mode (for Wiro.ai and others)
        const handler = getProviderWebSocketHandler(provider);

        setStatus("queued");
        setProgress(20);
        setStatusKey("connecting");

        const ws = new WebSocket(webSocketUrl);
        wsRef.current = ws;

        // Create callbacks for the handler
        const callbacks: WebSocketCallbacks = {
          setProgress,
          setStatus,
          setStatusMessage: setStatusKey,
          setError,
          onComplete: handleComplete,
          onCleanup: cleanupWebSocket,
        };

        ws.onopen = () => {
          const initMessage = handler.getInitMessage(socketAccessToken);
          if (initMessage) {
            ws.send(initMessage);
          }
          setStatusKey("connected");
        };

        ws.onmessage = (event) => {
          handler.handleMessage(event, callbacks);
        };

        ws.onerror = () => {
          setStatus("error");
          setError("WebSocket connection error");
          cleanupWebSocket();
        };

        ws.onclose = () => {
          if (status !== "completed" && status !== "error" && status !== "idle") {
            // Unexpected close
            setStatus("error");
            setError("Connection closed unexpectedly");
          }
        };
      }

    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Generation failed");
      cleanupWebSocket();
    }
  };

  const handleConfirmGenerate = () => {
    setStatus("confirming");
  };

  const handleCancelGeneration = () => {
    setStatus("idle");
    setSelectedModel(null);
    setError(null);
    setProgress(0);
    setStatusKey(null);
    cleanupWebSocket();
  };

  const isGenerating = status === "starting" || status === "queued" || status === "processing";

  // No models available - just show upload
  if (!isLoading && models.length === 0) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={onUploadClick}>
        <Upload className="h-4 w-4 mr-2" />
        {t("uploadMedia")}
      </Button>
    );
  }

  // Group models by provider
  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, MediaGeneratorModel[]>);

  const providerDisplayName = selectedModel?.providerName || selectedModel?.provider || "";

  const showInputImageField = mediaType === "VIDEO" || mediaType === "IMAGE";
  const isImageToVideoHint = inputImageUrl && selectedModel && (
    selectedModel.id.toLowerCase().includes("image-to-video") || 
    selectedModel.id.toLowerCase().includes("i2v")
  );

  return (
    <>
      <div className="space-y-3">
        {/* Input image field for VIDEO and IMAGE types */}
        {showInputImageField && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("inputImageOptional")}</label>
            {inputImageUrl ? (
              <div className="relative inline-block">
                <img 
                  src={inputImageUrl} 
                  alt="Input" 
                  className="max-h-32 rounded border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={() => setInputImageUrl("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                {!inputImageUploadMode ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setInputImageUploadMode(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {t("uploadInputImage")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setInputImageUploadMode(true)}
                    >
                      {t("pasteInputImageUrl")}
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-2 items-center w-full">
                    <input
                      ref={inputImageFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleInputImageUpload}
                      disabled={isUploadingInputImage}
                    />
                    <Input
                      placeholder={t("inputImageUrlPlaceholder")}
                      value={inputImageUrl}
                      onChange={(e) => setInputImageUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => inputImageFileRef.current?.click()}
                      disabled={isUploadingInputImage}
                    >
                      {isUploadingInputImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          {t("upload")}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setInputImageUploadMode(false);
                        setInputImageUrl("");
                      }}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={isGenerating || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  {t("generateMedia")}
                  <ChevronDown className="h-3 w-3 ml-2" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{t("chooseGenerator")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
              <div key={provider}>
                <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>{providerModels[0]?.providerName || provider}</span>
                  {providerModels[0]?.providerLogo && (
                    providerModels[0]?.providerLogoDark ? (
                      <>
                        <Image
                          src={providerModels[0].providerLogo}
                          alt={providerModels[0].providerName}
                          width={36}
                          height={12}
                          className="h-3 w-auto dark:hidden"
                        />
                        <Image
                          src={providerModels[0].providerLogoDark}
                          alt={providerModels[0].providerName}
                          width={36}
                          height={12}
                          className="h-3 w-auto hidden dark:block"
                        />
                      </>
                    ) : (
                      <Image
                        src={providerModels[0].providerLogo}
                        alt={providerModels[0].providerName}
                        width={36}
                        height={12}
                        className="h-3 w-auto dark:invert"
                      />
                    )
                  )}
                </DropdownMenuLabel>
                {providerModels.map((model) => (
                  <DropdownMenuItem
                    key={`${provider}-${model.id}`}
                    onClick={() => {
                      setSelectedModel(model);
                      handleConfirmGenerate();
                    }}
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    {model.name}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onUploadClick}>
              <Upload className="h-4 w-4 mr-2" />
              {t("uploadInstead")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {isGenerating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

        {/* Hint: Check if model is image-to-video compatible */}
        {inputImageUrl && selectedModel && !isImageToVideoHint && mediaType === "VIDEO" && (
          <div className="text-xs text-muted-foreground flex items-center gap-2 p-2 rounded border bg-muted/30">
            <AlertCircle className="h-3 w-3" />
            <span>{t("inputImageModelHint")}</span>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={status === "confirming"} onOpenChange={(open) => !open && handleCancelGeneration()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmGeneration")}</DialogTitle>
            <DialogDescription>
              {t("confirmGenerationDescription", { 
                provider: providerDisplayName,
                model: selectedModel?.name || ""
              })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="text-sm">
              <span className="font-medium">{t("promptPreview")}:</span>
              <p className="mt-1 p-2 rounded bg-muted text-muted-foreground text-xs line-clamp-3">
                {prompt || t("noPromptProvided")}
              </p>
            </div>
            
            {inputImageUrl && (
              <div className="text-sm">
                <span className="font-medium">{t("inputImage")}:</span>
                <img 
                  src={inputImageUrl} 
                  alt="Input" 
                  className="mt-1 max-h-20 rounded border"
                />
              </div>
            )}

            {/* Aspect Ratio selector for image and video generation (not for audio) */}
            {selectedModel && selectedModel.type !== "audio" && (
              <div className="text-sm">
                <span className="font-medium">{t("aspectRatio")}:</span>
                <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((ar) => (
                      <SelectItem key={ar.value} value={ar.value}>
                        {ar.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancelGeneration}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={handleGenerate} disabled={!prompt}>
              <Wand2 className="h-4 w-4 mr-2" />
              {t("startGeneration")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog open={isGenerating} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("generatingMedia", { provider: providerDisplayName })}
            </DialogTitle>
            <DialogDescription>
              {t("doNotCloseWindow")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {statusMessage}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result/Error Dialog */}
      <Dialog open={status === "completed" || status === "error"} onOpenChange={handleCancelGeneration}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {status === "completed" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  {t("generationComplete")}
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  {t("generationFailed")}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {status === "error" && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          
          {status === "completed" && (
            <p className="text-sm text-muted-foreground">
              {t("mediaAddedToPrompt")}
            </p>
          )}

          <DialogFooter>
            <Button type="button" onClick={handleCancelGeneration}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
