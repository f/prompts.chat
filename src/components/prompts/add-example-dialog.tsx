"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Loader2, Upload, Link, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/upload-limits";

interface AddExampleDialogProps {
  promptId: string;
  promptType: string;
  isLoggedIn: boolean;
  onExampleAdded?: () => void;
  asThumbnail?: boolean;
}

export function AddExampleDialog({
  promptId,
  promptType,
  isLoggedIn,
  onExampleAdded,
  asThumbnail = false,
}: AddExampleDialogProps) {
  const t = useTranslations("userExamples");
  const [open, setOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("url");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVideoType = promptType === "VIDEO";

  useEffect(() => {
    fetch("/api/config/storage")
      .then((res) => res.json())
      .then((data) => setUploadEnabled(data.mode !== "url"))
      .catch(() => setUploadEnabled(false));
  }, []);

  const handleClick = () => {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }
    setOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t("fileTooLarge", { size: MAX_UPLOAD_MB }));
      return;
    }

    const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const allowedVideoTypes = ["video/mp4"];
    const allowedTypes = isVideoType ? allowedVideoTypes : allowedImageTypes;
    
    if (!allowedTypes.includes(file.type)) {
      setError(t(isVideoType ? "invalidVideoType" : "invalidFileType"));
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      setMediaUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/prompts/${promptId}/examples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl,
          comment: comment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add example");
      }

      setMediaUrl("");
      setComment("");
      setOpen(false);
      onExampleAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add example");
    } finally {
      setIsLoading(false);
    }
  };

  const clearMedia = () => {
    setMediaUrl("");
    setError(null);
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {asThumbnail ? (
          <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }}
            className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer w-16 h-16 sm:w-20 sm:h-20"
          >
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
            <span className="text-[8px] text-muted-foreground font-medium">{t("addMyExample")}</span>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={handleClick} className="gap-1.5">
            <ImagePlus className="h-4 w-4" />
            {t("addMyExample")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("addExampleTitle")}</DialogTitle>
            <DialogDescription>
              {isVideoType ? t("addExampleDescriptionVideo") : t("addExampleDescriptionImage")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {mediaUrl ? (
              <div className="space-y-2">
                <Label>{isVideoType ? t("videoPreview") : t("imagePreview")}</Label>
                <div className="relative inline-block w-full">
                  <div className="rounded-lg overflow-hidden border bg-muted/30">
                    {isVideoType ? (
                      <video
                        src={mediaUrl}
                        controls
                        className="w-full max-h-48 object-contain"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl}
                        alt="Preview"
                        className="w-full max-h-48 object-contain"
                      />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={clearMedia}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="url" className="gap-1.5">
                    <Link className="h-4 w-4" />
                    {t("urlTab")}
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="gap-1.5" disabled={!uploadEnabled}>
                    <Upload className="h-4 w-4" />
                    {t("uploadTab")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="url" className="space-y-2 mt-3">
                  <Label htmlFor="mediaUrl">{isVideoType ? t("videoUrl") : t("imageUrl")}</Label>
                  <Input
                    id="mediaUrl"
                    type="url"
                    placeholder={isVideoType ? "https://example.com/my-video.mp4" : "https://example.com/my-image.png"}
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                </TabsContent>
                <TabsContent value="upload" className="mt-3">
                  <div
                    className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                    <p className="text-sm text-muted-foreground text-center">
                      {isUploading ? t("uploading") : t(isVideoType ? "clickToUploadVideo" : "clickToUpload")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("maxFileSize", { size: MAX_UPLOAD_MB })}
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={isVideoType ? "video/mp4" : "image/jpeg,image/png,image/gif,image/webp"}
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                </TabsContent>
              </Tabs>
            )}

            <div className="space-y-2">
              <Label htmlFor="comment">{t("commentOptional")}</Label>
              <Textarea
                id="comment"
                placeholder={t("commentPlaceholder")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {comment.length}/500
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading || isUploading}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isLoading || isUploading || !mediaUrl || !isValidUrl(mediaUrl)}>
              {isLoading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
