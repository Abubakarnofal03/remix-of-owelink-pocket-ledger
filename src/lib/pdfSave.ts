import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import jsPDF from "jspdf";
import { toast } from "@/hooks/use-toast";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Save a jsPDF document. On native (Capacitor), writes to device storage
 * and opens a share dialog. On web, triggers a browser download.
 */
export async function savePDF(doc: jsPDF, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const arrayBuffer = doc.output("arraybuffer");
      const base64Data = arrayBufferToBase64(arrayBuffer);

      const result = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: filename,
        url: result.uri,
      });
    } catch (error) {
      console.error("Failed to save/share PDF on native:", error);
      toast({
        title: "PDF Export Failed",
        description: "Could not save the PDF. Please try again.",
        variant: "destructive",
      });
    }
  } else {
    doc.save(filename);
  }
}
