import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import jsPDF from "jspdf";

/**
 * Save a jsPDF document. On native (Capacitor), writes to device storage
 * and opens a share dialog. On web, triggers a browser download.
 */
export async function savePDF(doc: jsPDF, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = doc.output("datauristring").split(",")[1];

      const result = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });

      await Share.share({
        title: filename,
        url: result.uri,
      });
    } catch (error) {
      console.error("Failed to save/share PDF on native:", error);
      // Fallback to web download
      doc.save(filename);
    }
  } else {
    doc.save(filename);
  }
}
