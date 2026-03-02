package app.lovable.c4b29d3de8d347a9bddd8699314dcb44;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdater extends Plugin {

    @PluginMethod()
    public void installApk(PluginCall call) {
        String fileName = call.getString("fileName");
        if (fileName == null || fileName.isEmpty()) {
            call.reject("File name is required");
            return;
        }

        try {
            // Check if we can install from unknown sources (Android 8+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!getContext().getPackageManager().canRequestPackageInstalls()) {
                    // Open settings to allow installing from this source
                    Intent settingsIntent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName())
                    );
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(settingsIntent);
                    call.reject("Please enable 'Install from unknown sources' for this app, then try again.");
                    return;
                }
            }

            // Find the APK file in the cache directory
            File cacheDir = getContext().getCacheDir();
            File apkFile = new File(cacheDir, fileName);

            if (!apkFile.exists()) {
                call.reject("APK file not found: " + fileName);
                return;
            }

            // Create install intent using FileProvider
            Uri apkUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apkFile
            );

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            getContext().startActivity(installIntent);

            call.resolve(new JSObject().put("success", true));
        } catch (Exception e) {
            call.reject("Failed to install APK: " + e.getMessage(), e);
        }
    }
}
