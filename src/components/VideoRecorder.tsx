import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Video, Square, Circle, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

export default function VideoRecorder({ onRecordingComplete }: VideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm",
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setHasRecording(true);
        onRecordingComplete(blob);

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Please allow camera & microphone access to record.");
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  }, []);

  const discardRecording = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setHasRecording(false);
    setDuration(0);
    chunksRef.current = [];
  }, [previewUrl]);

  const downloadRecording = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `interview-${Date.now()}.webm`;
    a.click();
  }, [previewUrl]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-6 space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Video className="w-4 h-4 text-nexus-red" />
        Interview Recording
      </div>

      {/* Live preview */}
      <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
        {isRecording && (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/90 text-destructive-foreground text-xs font-medium">
              <Circle className="w-2.5 h-2.5 fill-current animate-pulse" />
              REC {formatTime(duration)}
            </div>
          </>
        )}

        {!isRecording && hasRecording && previewUrl && (
          <video
            ref={previewVideoRef}
            src={previewUrl}
            controls
            playsInline
            className="w-full h-full object-cover"
          />
        )}

        {!isRecording && !hasRecording && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Video className="w-8 h-8" />
            <span className="text-sm">Click record to start capturing the interview</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!isRecording && !hasRecording && (
          <Button
            onClick={startRecording}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Circle className="w-4 h-4 mr-2 fill-current" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <Button
            onClick={stopRecording}
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            <Square className="w-4 h-4 mr-2 fill-current" />
            Stop Recording
          </Button>
        )}

        {hasRecording && !isRecording && (
          <>
            <Button onClick={downloadRecording} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button onClick={discardRecording} variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Discard
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}
